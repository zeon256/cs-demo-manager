export const PlayerSequenceEvent = {
	Kills: "kills",
	Deaths: "deaths",
	Rounds: "rounds",
	RoundsWithTeammates: "rounds-with-teammates",
} as const;

export type PlayerSequenceEvent =
	(typeof PlayerSequenceEvent)[keyof typeof PlayerSequenceEvent];

export function isValidPlayerSequenceEvent(
	value: string,
): value is PlayerSequenceEvent {
	return Object.values(PlayerSequenceEvent).includes(
		value as PlayerSequenceEvent,
	);
}
