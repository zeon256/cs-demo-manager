import type { Sequence } from "csdm/common/types/sequence";
import type { Match } from "csdm/common/types/match";
import type { HighlightsPayload } from "csdm/common/types/highlights-payload";

export function buildPlayersHighlightsSequences({
	match,
	steamIds,
	rounds,
	settings,
	firstSequenceNumber,
	minInterestScore,
	secondsBeforeAction,
	secondsAfterAction,
	voiceActivity,
	secondsBeforeVoice = 2,
	secondsAfterVoice = 2,
	roundStartMargin = 0,
	roundEndMargin = 0,
}: HighlightsPayload & { firstSequenceNumber: number }) {
	const sequences: Sequence[] = [];
	const { tickrate } = match;

	const targetTeamNames = new Set<string>();
	for (const steamId of steamIds) {
		const player = match.players.find((p) => p.steamId === steamId);
		if (player?.teamName) {
			targetTeamNames.add(player.teamName);
		}
	}

	const playersOptions = match.players.map((p) => ({
		steamId: p.steamId,
		playerName: p.name,
		showKill: true,
		highlightKill: false,
		isVoiceEnabled:
			steamIds.includes(p.steamId) || targetTeamNames.has(p.teamName),
	}));

	for (const round of match.rounds) {
		if (rounds.length > 0 && !rounds.includes(round.number)) {
			continue;
		}

		// Calculate interest for each tick in the round
		// For performance, we'll only check ticks where something happened
		const roundKills = match.kills.filter((k) => {
			if (k.roundNumber !== round.number) {
				return false;
			}
			if (steamIds.includes(k.killerSteamId)) {
				return true;
			}
			const killer = match.players.find((p) => p.steamId === k.killerSteamId);
			return (
				killer?.teamName !== undefined && targetTeamNames.has(killer.teamName)
			);
		});
		const roundShots = match.shots.filter(
			(s) =>
				s.roundNumber === round.number && steamIds.includes(s.playerSteamId),
		);

		// Interest events: [tick, score]
		const interestEvents: {
			tick: number;
			score: number;
			steamId: string;
			type: "kill" | "death" | "shot" | "voice";
			distance?: number;
		}[] = [];

		for (const kill of roundKills) {
			const isMainPlayer = steamIds.includes(kill.killerSteamId);
			interestEvents.push({
				tick: kill.tick,
				score: isMainPlayer ? 1000 : 800,
				steamId: kill.killerSteamId,
				type: "kill",
				distance: kill.distance,
			});
		}
		for (const shot of roundShots) {
			interestEvents.push({
				tick: shot.tick,
				score: 25,
				steamId: shot.playerSteamId,
				type: "shot",
			});
		}

		// Include deaths of the selected players and their teammates to provide context (e.g. site retake fails)
		const roundDeaths = match.kills.filter((k) => {
			if (k.roundNumber !== round.number) return false;
			// Check if victim is relevant (selected player or teammate)
			const victim = match.players.find((p) => p.steamId === k.victimSteamId);
			if (!victim) return false;

			// If victim is one of the selected players -> Relevant
			if (steamIds.includes(k.victimSteamId)) return true;

			// If victim is a teammate of selected players -> Relevant
			if (victim.teamName && targetTeamNames.has(victim.teamName)) return true;

			return false;
		});

		for (const kill of roundDeaths) {
			// We want to switch to the victim slightly BEFORE they die to see the death context.
			// using secondsBeforeAction ensures consistency with the segment start logic.
			const lookbackTicks = Math.round(secondsBeforeAction * tickrate);
			const eventTick = Math.max(
				round.startTick - roundStartMargin * tickrate,
				kill.tick - lookbackTicks,
			);
			interestEvents.push({
				tick: eventTick,
				score: 100,
				steamId: kill.victimSteamId,
				type: "death",
				distance: kill.distance,
			});
		}

		if (voiceActivity) {
			const roundVoiceActivity = voiceActivity.filter(
				(v) =>
					steamIds.includes(v.steamId) &&
					v.endTick >= round.startTick &&
					v.startTick <= round.endTick,
			);

			for (const activity of roundVoiceActivity) {
				// Extend the voice activity duration by the configured padding
				const startWithPadding =
					activity.startTick - secondsBeforeVoice * tickrate;
				const endWithPadding = activity.endTick + secondsAfterVoice * tickrate;

				// Add an interest event every second (approx) during the voice activity
				// We clamp the ticks to the round boundaries (with margins) to ensure we don't generate interest points
				// for parts of the conversation that happened WAY outside the round context.
				const startLoopTick = Math.max(
					startWithPadding,
					round.startTick - roundStartMargin * tickrate,
				);
				const endLoopTick = Math.min(
					endWithPadding,
					round.endTick + roundEndMargin * tickrate,
				);

				for (let tick = startLoopTick; tick <= endLoopTick; tick += tickrate) {
					interestEvents.push({
						tick,
						score: 500, // Very high score to ensure it's included
						steamId: activity.steamId,
						type: "voice",
					});
				}
			}
		}

		if (interestEvents.length === 0) continue;
		const distanceHeuristicMax = 800;
		const distanceHeuristicMin = 400;
		const filteredEvents = interestEvents
			.filter((e) => e.score >= minInterestScore)
			.sort((a, b) => {
				if (a.tick !== b.tick) {
					return a.tick - b.tick;
				}

				// If ticks are equal, prioritize "Close Combat" over "Far Away Sniper" if possible.
				// Heuristic: If A is a Far Kill (>800 units) and B is a Close Death (<400 units), prefer B (Death).
				// Camera logic: The LAST event in the list "wins" (overwrites previous spec commands).
				// So we want the high priority event to be LAST.

				const aIsFarKill =
					a.type === "kill" &&
					(a.distance === undefined || a.distance > distanceHeuristicMax);
				const bIsCloseDeath =
					b.type === "death" &&
					b.distance !== undefined &&
					b.distance < distanceHeuristicMin;

				if (aIsFarKill && bIsCloseDeath) {
					return -1; // a (Kill) comes first -> [Kill, Death] -> Death Wins
				}

				const bIsFarKill =
					b.type === "kill" &&
					(b.distance === undefined || b.distance > distanceHeuristicMax);
				const aIsCloseDeath =
					a.type === "death" &&
					a.distance !== undefined &&
					a.distance < distanceHeuristicMin;

				if (bIsFarKill && aIsCloseDeath) {
					return 1; // b (Kill) comes first -> [Kill, Death] -> Death Wins
				}

				// Default: Prioritize higher score events (Kills > Voice > Deaths > Shots)
				// Ascending Sort: [Low Score, High Score] -> High Score Wins.
				return a.score - b.score;
			});

		if (filteredEvents.length === 0) continue;

		// === HEURISTIC: Look-ahead suppression ===
		// Skip teammate events (KILLS or DEATHS) if a main player has a KILL coming within a short window.
		// This prevents jarring rapid camera switches when the main player is in the middle of an action.
		const mainPlayerPriorityWindowTicks = Math.round(
			secondsBeforeAction * tickrate,
		);

		// Helper: Check if a steamId belongs to a main player (selected players)
		const isMainPlayer = (steamId: string) => steamIds.includes(steamId);

		// Filter events using look-ahead suppression
		const eventsWithLookahead = filteredEvents.filter((event, index) => {
			const eventIsMain = isMainPlayer(event.steamId);

			// Check for any upcoming KILL that should take priority over this event
			const upcomingPriorityKill = filteredEvents.slice(index + 1).find((e) => {
				if (e.type !== "kill") return false;
				if (e.tick - event.tick > mainPlayerPriorityWindowTicks) return false;
				if (e.steamId === event.steamId) return false; // Don't suppress a player's own events

				const eIsMain = isMainPlayer(e.steamId);

				// Priority 1: If the upcoming kill is by a Main Player, it suppresses EVERYTHING else
				// (including teammate kills and any deaths).
				if (eIsMain) return true;

				// Priority 2: If the upcoming kill is by a Teammate, it suppresses DEATHS
				// (to maintain continuity for whoever is about to get a kill).
				if (!eIsMain && event.type === "death") return true;

				// Priority 3: A Main Player kill (at the same tick) already wins due to score sorting,
				// so we don't need to suppress it here; we only care about distracting lead-ups.
				return false;
			});

			if (upcomingPriorityKill) {
				// Sacrifice this event to maintain focus on the higher-priority upcoming action
				return false;
			}

			return true;
		});

		// Group events into segments
		const segments: {
			startTick: number;
			endTick: number;
			cameraFocus: { tick: number; steamId: string; score: number }[];
		}[] = [];
		const maxGapTicks = tickrate * 30; // 30 seconds gap between interest points

		for (const event of eventsWithLookahead) {
			const lastSegment =
				segments.length > 0 ? segments[segments.length - 1] : undefined;
			const startTick = Math.max(
				round.startTick - roundStartMargin * tickrate,
				event.tick - secondsBeforeAction * tickrate,
			);
			const endTick = Math.min(
				round.endTick + roundEndMargin * tickrate,
				event.tick + secondsAfterAction * tickrate,
			);

			if (lastSegment && event.tick <= lastSegment.endTick + maxGapTicks) {
				lastSegment.endTick = Math.max(lastSegment.endTick, endTick);
				lastSegment.cameraFocus.push({
					tick: event.tick,
					steamId: event.steamId,
					score: event.score,
				});
			} else {
				segments.push({
					startTick,
					endTick,
					cameraFocus: [
						{ tick: event.tick, steamId: event.steamId, score: event.score },
					],
				});
			}
		}

		// Post-process segments to improve viewing experience
		// Extend to round end ONLY if there are events of interest after the segment's natural end.
		// However, we ALWAYS extend to at least the round end tick to ensure the win/loss outcome is shown.
		if (segments.length > 0) {
			const lastSegment = segments[segments.length - 1];
			const roundEndWithMargin = round.endTick + roundEndMargin * tickrate;

			// Check if there are any interest events happening after the segment's natural end
			const hasEventsAfterSegmentEnd = eventsWithLookahead.some(
				(e) => e.tick > lastSegment.endTick && e.tick <= roundEndWithMargin,
			);

			if (hasEventsAfterSegmentEnd) {
				// There's still action happening (or voice), extend to round end with margin
				lastSegment.endTick = roundEndWithMargin;
			} else {
				// No more interest events, but we still want to show the round outcome (win/loss message and sound)
				// So we extend the segment to the official round end tick
				lastSegment.endTick = Math.max(lastSegment.endTick, round.endTick);
			}
		}

		// === HEURISTIC: Adaptive early switch ===
		// If the current POV has been "quiet" (no events) for a while, switch to the next player earlier.
		// This ensures we don't watch boring moments when we could be watching the next interesting player.
		const quietThresholdTicks = Math.round(3 * tickrate); // 3 seconds of no action = boring
		const minLeadTimeTicks = Math.round(1 * tickrate); // At least 1 second before event

		for (const segment of segments) {
			// Create camera switches with adaptive timing
			const rawCameras: {
				tick: number;
				playerSteamId: string;
				playerName: string;
			}[] = [];

			for (let i = 0; i < segment.cameraFocus.length; i++) {
				const cf = segment.cameraFocus[i];
				const prevCf = i > 0 ? segment.cameraFocus[i - 1] : null;

				let switchTick: number;

				if (i === 0) {
					// First camera in segment, use segment start
					switchTick = segment.startTick;
				} else if (prevCf && cf.steamId !== prevCf.steamId) {
					// Switching to a different player - apply adaptive timing
					const defaultSwitchTick =
						cf.tick - Math.round(secondsBeforeAction * tickrate);

					// Find the last event from the previous POV player
					const lastEventFromPrevPOV = segment.cameraFocus
						.slice(0, i)
						.filter((c) => c.steamId === prevCf.steamId)
						.pop();

					if (lastEventFromPrevPOV) {
						const quietDuration = cf.tick - lastEventFromPrevPOV.tick;

						if (quietDuration > quietThresholdTicks) {
							// Previous POV has been quiet, switch earlier (shortly after their last event)
							const earlySwitchTick =
								lastEventFromPrevPOV.tick + minLeadTimeTicks;
							switchTick = Math.max(
								earlySwitchTick,
								prevCf.tick + minLeadTimeTicks, // Don't switch before previous event settles
							);
							// But don't switch LATER than default
							switchTick = Math.min(switchTick, defaultSwitchTick);
						} else {
							// Previous POV still has action, use default timing
							switchTick = defaultSwitchTick;
						}
					} else {
						switchTick = defaultSwitchTick;
					}

					// Ensure we don't switch before the segment started
					switchTick = Math.max(switchTick, segment.startTick);
				} else {
					// Same player, use event tick (this shouldn't generate a new camera entry anyway)
					switchTick = cf.tick;
				}

				rawCameras.push({
					tick: switchTick,
					playerSteamId: cf.steamId,
					playerName:
						match.players.find((p) => p.steamId === cf.steamId)?.name ?? "",
				});
			}

			const playerCameras: typeof rawCameras = [];

			for (let i = 0; i < rawCameras.length; i++) {
				const currentCam = rawCameras[i];
				playerCameras.push(currentCam);

				const nextTick =
					i + 1 < rawCameras.length ? rawCameras[i + 1].tick : segment.endTick;

				let currentSteamId = currentCam.playerSteamId;
				let currentTick = currentCam.tick;

				// Check if the current player dies before the next scheduled camera switch
				while (currentTick < nextTick) {
					const death = match.kills.find(
						(k) =>
							k.roundNumber === round.number &&
							k.victimSteamId === currentSteamId &&
							k.tick >= currentTick &&
							k.tick < nextTick,
					);

					if (!death) {
						break;
					}

					const victim = match.players.find(
						(p) => p.steamId === currentSteamId,
					);
					if (!victim) {
						break;
					}

					// Find an alive teammate to switch to
					const teammates = match.players.filter(
						(p) =>
							p.teamName === victim.teamName && p.steamId !== currentSteamId,
					);
					const aliveTeammates = teammates.filter((t) => {
						const tDeath = match.kills.find(
							(k) =>
								k.roundNumber === round.number && k.victimSteamId === t.steamId,
						);
						return !tDeath || tDeath.tick > death.tick;
					});

					aliveTeammates.sort((a, b) => {
						const aKill = match.kills.find(
							(k) =>
								k.roundNumber === round.number &&
								k.killerSteamId === a.steamId &&
								k.tick > death.tick,
						);
						const bKill = match.kills.find(
							(k) =>
								k.roundNumber === round.number &&
								k.killerSteamId === b.steamId &&
								k.tick > death.tick,
						);

						if (aKill && !bKill) {
							return -1;
						}
						if (!aKill && bKill) {
							return 1;
						}
						if (aKill && bKill) {
							return aKill.tick - bKill.tick;
						}

						// If neither kills, prefer the one who survives the longest to avoid switching to someone who dies immediately
						const aDeath = match.kills.find(
							(k) =>
								k.roundNumber === round.number && k.victimSteamId === a.steamId,
						);
						const bDeath = match.kills.find(
							(k) =>
								k.roundNumber === round.number && k.victimSteamId === b.steamId,
						);

						if (!aDeath && bDeath) {
							return -1;
						}
						if (aDeath && !bDeath) {
							return 1;
						}

						if (aDeath && bDeath) {
							return bDeath.tick - aDeath.tick;
						}

						return 0;
					});

					const aliveTeammate = aliveTeammates[0];

					if (aliveTeammate) {
						playerCameras.push({
							tick: death.tick,
							playerSteamId: aliveTeammate.steamId,
							playerName: aliveTeammate.name,
						});

						currentSteamId = aliveTeammate.steamId;
						currentTick = death.tick;
					} else {
						// Everyone is dead
						break;
					}
				}
			}

			// Deduplicate consecutive camera focuses on the same player
			const dedupedCameras = playerCameras.filter((cam, index, self) => {
				return (
					index === 0 || cam.playerSteamId !== self[index - 1].playerSteamId
				);
			});

			sequences.push({
				number: firstSequenceNumber + sequences.length,
				startTick: segment.startTick,
				endTick: segment.endTick,
				showOnlyDeathNotices: settings.showOnlyDeathNotices,
				showHud: settings.showHud,
				deathNoticesDuration: settings.deathNoticesDuration,
				showXRay: settings.showXRay,
				showAssists: settings.showAssists,
				recordAudio: settings.recordAudio,
				playerVoicesEnabled: settings.playerVoicesEnabled,
				playersOptions,
				playerCameras: dedupedCameras,
				cameras: [],
			});
		}
	}

	return sequences;
}
