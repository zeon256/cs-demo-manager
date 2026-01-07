# Watch Demo Sequences

The "Watch Demo Sequences" feature allows you to play back specific parts of a Counter-Strike demo automatically, with the camera focused on specific players or events. It essentially acts as a modern, programmable version of the older `.vdm` files used by Valve.

## How it works

For a deep dive into the underlying technology used for recording on Windows, see [HLAE Recording on Windows](./hlae-recording.md).

### Watch Modes
There are two ways to watch your sequences:
- **Watch sequences**: Standard mode that prepares the game engine for high-quality recording. This mode locks the framerate and disables interpolation, which can feel "laggy" but ensures perfect frame timing.
- **Watch smooth sequences**: A preview mode that plays the sequences using your normal game settings. This mode maintains high FPS and movement interpolation, making it ideal for reviewing sequences before recording. You can customize the target FPS for this mode in the Video settings.

### 1. Sequence Generation
Before you can "watch" sequences, they must be created in the UI via the **"Generate player's sequences"** button. The system calculates the **Start Tick** and **End Tick** by applying offsets (e.g., "5 seconds before the kill"). If events are close together, they are merged into a single continuous sequence.

### 2. Communication Flow
When you click **"Watch sequences"**:
1.  **Frontend**: The UI sends a WebSocket message (`WatchVideoSequences`) to the Electron backend.
2.  **Backend**: Triggers the generation of a **JSON Action File** named after your demo (e.g., `match_demo.dem.json`).
3.  **JSON Generation**: This file contains the "script" for the demo, including commands like `spec_player <slot>`, `spec_mode 1`, and `cl_draw_only_deathnotices 1`.

### 3. Game Launch
The backend starts the game using the `+playdemo <path>` launch option. The game must be launched with the `-insecure` flag so that the custom **CS:DM Server Plugin** can be loaded.

### 4. The CS:DM Plugin (C++)
The C++ plugin (`cs2-server-plugin/main.cpp`) handles the internal playback logic:
*   **Action Execution**: Every tick, the plugin checks the JSON "script" and executes the scheduled commands via the game engine.
*   **Sequence Progression**: When a sequence ends, it triggers `demo_gototick` to the start of the next sequence.

## Why it may feel "Laggy"

The "lag" experienced during playback is actually a result of the app putting the game into a **"Recording Simulation"** mode. It is configuring the engine to behave exactly as if it were being recorded by high-quality movie-making tools.

### 1. Locked Framerate (`host_framerate`)
In normal demo playback, the game uses interpolation to make movement look smooth at high FPS. When watching sequences, the app executes `host_framerate 30` (or your set recording framerate).
*   This **disables internal smoothing** (interpolation).
*   It locks visual output to a low, rigid framerate to ensure perfect frame timing for potential recording.

### 2. Custom Plugin Interaction
The custom CS:DM plugin interacts with the engine's tick system every single frame to ensure commands are executed at the exact right moment.

### 3. Setup Pauses
The plugin intentionally triggers a `demo_pause` for **2 seconds** at the start of each sequence. This is a workaround to avoid recording "fade-in" tint effects or loading screen artifacts, ensuring the "camera" is correctly positioned before the action starts.

### 4. Clean HUD Configuration
Settings like `cl_draw_only_deathnotices 1` and disabling telemetry charts are applied to ensure a clean visual experience, which differs from the standard game HUD users are accustomed to.
