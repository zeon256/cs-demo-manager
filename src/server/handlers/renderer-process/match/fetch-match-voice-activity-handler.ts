import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { startCsgoVoiceExtractor } from "csdm/node/csgo-voice-extractor/start-csgo-voice-extractor";
import { ExportVoiceMode } from "csdm/node/csgo-voice-extractor/export-voice-mode";
import type { VoiceActivity } from "csdm/common/types/voice-activity";

export type FetchMatchVoiceActivityPayload = {
	demoFilePath: string;
	steamIds: string[];
};

export async function fetchMatchVoiceActivityHandler(
	payload: FetchMatchVoiceActivityPayload,
): Promise<VoiceActivity[]> {
	const { demoFilePath, steamIds } = payload;
	if (!fs.existsSync(demoFilePath)) {
		throw new Error("Demo file not found");
	}

	const tempDir = await fs.mkdtemp(
		path.join(os.tmpdir(), "csdm-voice-activity-"),
	);
	const voiceActivity: VoiceActivity[] = [];

	try {
		await startCsgoVoiceExtractor({
			demoPath: demoFilePath,
			outputFolderPath: tempDir,
			mode: ExportVoiceMode.SplitCompact,
			steamIds,
		});

		const files = await fs.readdir(tempDir);
		// Expected format: steamId_startTick_endTick.wav
		// Example: 76561198000000000_1234_2345.wav
		const regex = /^(\d+)_(\d+)_(\d+)\.wav$/;

		for (const file of files) {
			const match = file.match(regex);
			if (match) {
				const [, steamId, startTick, endTick] = match;
				voiceActivity.push({
					steamId,
					startTick: Number.parseInt(startTick, 10),
					endTick: Number.parseInt(endTick, 10),
				});
			}
		}
	} finally {
		await fs.remove(tempDir);
	}

	return voiceActivity;
}
