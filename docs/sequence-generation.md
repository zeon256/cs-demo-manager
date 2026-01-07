# Sequence Generation Technical Documentation

This document describes how CS:DM generates video sequences for automated demo playback and recording.

## Overview Flow

The generation process follows a unidirectional flow from user interaction to a state-ready sequence list:

1.  **UI**: User opens the "Generate player's sequences" dialog in `src/ui/match/video/generate-player-sequences-button.tsx`.
2.  **Action**: Dispatching a Redux action (e.g., `generatePlayersKillsSequences`) from `src/ui/match/video/sequences/sequences-actions.ts`.
3.  **Reducer**: The `sequencesReducer` in `src/ui/match/video/sequences/sequences-reducer.ts` catches the action and calls a "Build" function.
4.  **Logic**: The build functions in `src/common/video/sequences/` process the match data to calculate ticks and camera switches.
5.  **State**: The resulting `Sequence[]` is stored in the Redux state, keyed by the demo file path.

---

## Sequence Data Structure

A `Sequence` object (defined in `src/common/types/sequence.ts`) is the blueprint for a single "clip":

```typescript
export type Sequence = {
  number: number;           // Index of the sequence
  startTick: number;        // When the clip begins
  endTick: number;          // When the clip ends
  playerCameras: {          // Chronological list of camera targets
    tick: number;
    playerSteamId: string;
    playerName: string;
  }[];
  playersOptions: {         // Individual player settings (HUD/Voice)
    steamId: string;
    isVoiceEnabled: boolean;
    showKill: boolean;
    // ...
  }[];
  // ... settings like showXRay, recordAudio, etc.
};
```

---

## Generation Logic

### 1. Kills & Deaths (`build-players-event-sequences.ts`)
This is the most complex logic because it handles **proximity merging**:

-   **Merging Window**: If two kills happen within **10 seconds** of each other, they are merged into one continuous sequence.
-   **Buffer Window**: If two separate sequences would end up with less than **2 seconds** between them, they are merged.
-   **Camera Switching**: When merged, a new entry is added to `playerCameras` at the **midpoint tick** between the two events.
-   **Offsets**: `startSecondsBeforeEvent` and `endSecondsAfterEvent` (user-configurable) are applied to the first and last events in a merged group.
-   **Minimum Kills Filter**: Users can filter sequences to only include those with a minimum number of kills (e.g., to generate separate clips for Multi-kills).

### 2. Rounds with Teammate Switch (`build-players-rounds-with-teammates-sequences.ts`)
Used for maintaining POV even after death:

-   **Primary Target**: Starts at `round.freezetimeEndTick`.
-   **Death Detection**: If the focused player dies, the logic searches for the first alive teammate.
-   **Switch Chain**: It continues switching to the next alive teammate every time the current POV dies until the round ends or everyone is dead.
-   **Verification**: Only generates sequences for rounds where the target player actually did something (fired a shot or died).

### 3. Standard Rounds (`build-players-rounds-sequences.ts`)
-   Focuses on one player for the duration of their life in a round.
-   Ends the sequence when the player dies (plus offset) or the round ends.

---

## From State to Game (JSON Action File)

When the user clicks "Watch", the app takes the `Sequence[]` from state and uses the `JSONActionsFileGenerator`:

1.  **Ticks to Commands**: It iterates through sequences and transforms `playerCameras` into `spec_player <steamId>` commands.
2.  **Navigation**: Adds `demo_gototick` at the end of each sequence to skip the "boring" parts and jump to the next `startTick`.
3.  **Environment**: Applies global settings (e.g., `cl_draw_only_deathnotices`, `voice_enable`) at the appropriate ticks.
4.  **The `.json` File**: A file named `demo_name.dem.json` is saved next to the demo. The C++ server plugin reads this file tick-by-tick and executes the commands.

---

## Smart Highlights Generation (`build-players-highlights-sequences.ts`)

The "Smart Highlights" mode (Action: `generatePlayersHighlightsSequences`) dynamically identifies and merges interesting moments based on gameplay events and voice activity. This is the most advanced generation mode.

### Interest Score System
The system assigns a score to every meaningful tick in a round:
-   **Kills**: Base score of **1000** for the selected player. Kills by teammates are also included with a score of **800**, ensuring you see their key moments while keeping priority on the main player.
-   **Relevant Deaths**: Base score of **100**. Includes deaths of selected players and their teammates. The system switches to the victim shortly before the death to show the context (e.g., a site retake failing), then immediately switches to an alive teammate.
-   **Shots Fired**: Base score of **25**.
-   **Voice Activity**: Segments with voice chat get a high score of **500**. This includes conversations that start *before* the round (e.g., during the transition/scoreboard) and continue into the round (freeze time). The system intelligently captures the relevant portion. You can also configure specific "seconds before/after" padding for voice activity, independent of combat events.

### Priority System & Proximity Logic
When multiple interest events occur simultaneously (or at the same tick), the system must decide which player to focus on. The prioritization logic is as follows:

1.  **Close Combat Override**: If a **High Priority Event** (Kill, Score 1000) happens at the same time as a **Lower Priority Event** (Death, Score 100), the system checks the distance.
    -   If the **Killer** is *far away* (> 800 units, sniper range) and the **Death** (e.g., a teammate dying) is *close* (< 400 units), the camera will **prioritize the Death**. This ensures the viewer sees the immediate, intense action rather than switching to a distant sniper.
2.  **Score Priority**: If the proximity override doesn't trigger, the event with the highest score wins (Kills > Voice > Deaths > Shots).

### Configurable Round Boundaries
User can now configure additional padding for round boundaries in Highlights mode:
-   **Round Start Margin**: Loosens the start time constraint, allowing sequences to potentially start slightly before the official `round.startTick` if an interest event happens extremely early or to provide more context.
-   **Round End Margin**: Extends the final sequence of the round beyond `round.endTick`, allowing the user to watch post-round events like scoreboards or celebrations.

### Logic Flow
1.  **Event Collection**: It scans the round for all kills, shots, and valid voice segments for the selected players.
2.  **Filtering**:
    -   Events are filtered by the user-defined `minInterestScore`.
    -   Voice activity is strictly filtered to the relevant steam IDs.
3.  **Look-ahead Suppression**:
    -   Before processing events, the system applies a **look-ahead filter** to prevent distracting and jarring camera switches.
    -   If any event (teammate kill, teammate death, or even a selected player's death) occurs and another **selected player** has a **kill** coming within a short window (defined by `secondsBeforeAction`), the event is **skipped**.
    -   **Kills by selected players are never suppressed.**
    -   This logic "sacrifices" less important context (like a teammate dying) to ensure the camera stays focused on a main player who is in the middle of a successful action.
    -   Example: Teammate B dies at tick 1000, but Main Player A is about to get a kill at tick 1010. The system skips the switch to B's death to keep the focus on A's upcoming kill.
4.  **Segment Grouping**:
    -   **Merging Gap**: Events occurring within **30 seconds** (`maxGapTicks`) of each other are grouped into a single continuous sequence. This ensures better continuity between related events.
    -   **Dynamic Extension**: The segment automatically expands to encompass the earliest start and latest end of its grouped events, plus the user's `secondsBeforeAction` and `secondsAfterAction` padding.
    -   **Intelligent Round Ending**: The final sequence of a round is intelligently managed to avoid long periods of inactivity while ensuring closure. If there are **events of interest** (kills, shots, voice) happening after the primary action, the sequence is extended to `round.endTick` (+ `roundEndMargin`). Even in "save" scenarios where no activity remains, the system **always extends to the round end tick** to capture the win/loss message and sound. This provides a clean transition between rounds without the long, boring stretches of eco-save rounds.
5.  **Camera & Audio Control**:
    -   **Dynamic Camera**: The camera automatically switches focus to the player responsible for the specific "interest event" at that tick. Consecutive switches are deduplicated.
    -   **Adaptive Early Switch**: Instead of always switching exactly `secondsBeforeAction` before the next event, the system checks if the current POV has been "quiet" (no events for **3+ seconds**). If quiet, it switches to the next player **earlier** (1 second after the current player's last event). This ensures the viewer is always watching something interesting instead of staring at a player doing nothing.
    -   **Smart Death Camera**: If the focused player dies during a sequence, the camera automatically switches to an alive teammate. The selection algorithm prioritizes teammates who **get a kill** shortly after the death. If no one gets a kill, it prioritizes the teammate who **survives the longest**. This ensures the viewer sees active gameplay rather than switching to another player just about to die.
    -   **Smart Audio**: `isVoiceEnabled` is intelligently calculated. It is enabled **only** for the selected players and their **teammates**. This prevents leaking opponent voice chat, which can be confusing during playback.
