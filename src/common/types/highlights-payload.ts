import type { Match } from "csdm/common/types/match";
import type { VideoSettings } from "csdm/node/settings/settings";
import type { VoiceActivity } from "csdm/common/types/voice-activity";

export type HighlightsPayload = {
	steamIds: string[];
	match: Match;
	rounds: number[];
	settings: VideoSettings;
	preserveExistingSequences: boolean;
	minInterestScore: number;
	secondsBeforeAction: number;
	secondsAfterAction: number;
	voiceActivity?: VoiceActivity[];
	secondsBeforeVoice?: number;
	secondsAfterVoice?: number;
	roundStartMargin?: number;
	roundEndMargin?: number;
}; // End of HighlightsPayload definition
