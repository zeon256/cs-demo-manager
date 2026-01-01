import React, { type FocusEvent } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { InputNumber } from "csdm/ui/components/inputs/number-input";
import { useVideoSettings } from "csdm/ui/settings/video/use-video-settings";

export function SmoothFramerateInput() {
	const { t } = useLingui();
	const { settings, updateSettings } = useVideoSettings();

	const onBlur = async (event: FocusEvent<HTMLInputElement>) => {
		let newFramerate = Number(event.target.value);
		if (newFramerate < 0) {
			newFramerate = 0;
			event.target.value = "0";
		}

		await updateSettings({
			smoothFramerate: newFramerate,
		});
	};

	return (
		<InputNumber
			key={settings.smoothFramerate}
			label={
				<Trans context="Input label">Smooth mode FPS (0 = unlimited)</Trans>
			}
			min={0}
			defaultValue={settings.smoothFramerate}
			onBlur={onBlur}
			placeholder={t({
				context: "Input placeholder",
				message: "FPS",
			})}
		/>
	);
}
