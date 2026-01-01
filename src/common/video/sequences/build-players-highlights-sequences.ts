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

		// Group events into segments
		const segments: {
			startTick: number;
			endTick: number;
			cameraFocus: { tick: number; steamId: string }[];
		}[] = [];
		const maxGapTicks = tickrate * 30; // 30 seconds gap between interest points (increased from 5s to improve continuity)

		for (const event of filteredEvents) {
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
				});
			} else {
				segments.push({
					startTick,
					endTick,
					cameraFocus: [{ tick: event.tick, steamId: event.steamId }],
				});
			}
		}

		// Post-process segments to improve viewing experience
		// Always finish the round if we have at least one sequence.
		// This ensures we don't cut off just before the round end and improves continuity.
		// We also apply the roundEndMargin here to potentially see the scoreboard/post-round.
		if (segments.length > 0) {
			segments[segments.length - 1].endTick =
				round.endTick + roundEndMargin * tickrate;
		}

		for (const segment of segments) {
			// Create camera switches. For now, switch to the player who triggered the interest at their event tick.
			const rawCameras = segment.cameraFocus.map((cf, index) => ({
				tick: index === 0 ? segment.startTick : cf.tick,
				playerSteamId: cf.steamId,
				playerName:
					match.players.find((p) => p.steamId === cf.steamId)?.name ?? "",
			}));

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
