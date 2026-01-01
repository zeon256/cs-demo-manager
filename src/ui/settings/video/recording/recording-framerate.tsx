import React from "react";
import type { FocusEvent } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { InputNumber } from "csdm/ui/components/inputs/number-input";
import { useVideoSettings } from "csdm/ui/settings/video/use-video-settings";
import { defaultSettings } from "csdm/node/settings/default-settings";

export function RecordingFramerate() {
	const { t } = useLingui();
	const { settings, updateSettings } = useVideoSettings();

	const onBlur = async (event: FocusEvent<HTMLInputElement>) => {
		let framerate = Number(event.target.value);
		if (framerate <= 0) {
			framerate = defaultSettings.video.framerate;
			event.target.value = framerate.toString();
		}

		await updateSettings({
			framerate,
		});
	};

	return (
		<InputNumber
			key={settings.framerate}
			label={<Trans context="Input label">Framerate</Trans>}
			min={1}
			defaultValue={settings.framerate}
			onBlur={onBlur}
			placeholder={t({
				context: "Input placeholder",
				message: "Framerate",
			})}
		/>
	);
}
