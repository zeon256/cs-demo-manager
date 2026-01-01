import type { Sequence } from "csdm/common/types/sequence";
import type { Match } from "csdm/common/types/match";
import type { VideoSettings } from "csdm/node/settings/settings";
import type { PlayerCameraFocus } from "csdm/common/types/player-camera-focus";

type Options = {
	match: Match;
	steamIds: string[];
	rounds: number[];
	startSecondsBeforeEvent: number;
	endSecondsAfterEvent: number;
	settings: Pick<
		VideoSettings,
		| "showOnlyDeathNotices"
		| "deathNoticesDuration"
		| "showXRay"
		| "showAssists"
		| "recordAudio"
		| "playerVoicesEnabled"
		| "showHud"
	>;
	firstSequenceNumber: number;
};

export function buildPlayersRoundsWithTeammatesSequences({
	match,
	steamIds,
	rounds,
	startSecondsBeforeEvent,
	endSecondsAfterEvent,
	settings,
	firstSequenceNumber,
}: Options) {
	const sequences: Sequence[] = [];
	const tickrate = match.tickrate;

	for (const steamId of steamIds) {
		const player = match.players.find((p) => p.steamId === steamId);
		if (!player) {
			continue;
		}

		for (const round of match.rounds) {
			if (rounds.length > 0 && !rounds.includes(round.number)) {
				continue;
			}

			const hasShot = match.shots.some((shot) => {
				return (
					shot.roundNumber === round.number && shot.playerSteamId === steamId
				);
			});
			const playerDeathInRound = match.kills.find((kill) => {
				return (
					kill.roundNumber === round.number && kill.victimSteamId === steamId
				);
			});

			if (hasShot || playerDeathInRound) {
				const startTick =
					round.freezetimeEndTick - tickrate * startSecondsBeforeEvent;
				const endTick = round.endTick + tickrate * endSecondsAfterEvent;

				const playerCameras: PlayerCameraFocus[] = [
					{
						tick: startTick,
						playerSteamId: steamId,
						playerName: player.name,
					},
				];

				let currentFocusedSteamId = steamId;
				let lastDeathTick = playerDeathInRound ? playerDeathInRound.tick : -1;

				while (lastDeathTick !== -1 && lastDeathTick < round.endTick) {
					const aliveTeammates = match.players.filter((p) => {
						if (
							p.teamName !== player.teamName ||
							p.steamId === currentFocusedSteamId ||
							p.steamId === steamId
						) {
							return false;
						}
						const death = match.kills.find(
							(k) =>
								k.roundNumber === round.number && k.victimSteamId === p.steamId,
						);
						return !death || death.tick > lastDeathTick;
					});

					if (aliveTeammates.length > 0) {
						const nextTeammate = aliveTeammates[0];
						playerCameras.push({
							tick: lastDeathTick,
							playerSteamId: nextTeammate.steamId,
							playerName: nextTeammate.name,
						});
						currentFocusedSteamId = nextTeammate.steamId;
						const nextDeath = match.kills.find(
							(k) =>
								k.roundNumber === round.number &&
								k.victimSteamId === currentFocusedSteamId,
						);
						lastDeathTick = nextDeath ? nextDeath.tick : -1;
					} else {
						break;
					}
				}

				if (currentFocusedSteamId !== steamId) {
					playerCameras.push({
						tick: round.endTick,
						playerSteamId: steamId,
						playerName: player.name,
					});
				}

				const playersOptions = match.players.map((p) => ({
					steamId: p.steamId,
					playerName: p.name,
					showKill: true,
					highlightKill: false,
					isVoiceEnabled: p.teamName === player.teamName,
				}));

				sequences.push({
					number: firstSequenceNumber + sequences.length,
					startTick,
					endTick,
					showOnlyDeathNotices: settings.showOnlyDeathNotices,
					showHud: settings.showHud,
					deathNoticesDuration: settings.deathNoticesDuration,
					showXRay: settings.showXRay,
					showAssists: settings.showAssists,
					recordAudio: settings.recordAudio,
					playerVoicesEnabled: settings.playerVoicesEnabled,
					playersOptions,
					playerCameras,
					cameras: [],
				});
			}
		}
	}

	return sequences;
}
