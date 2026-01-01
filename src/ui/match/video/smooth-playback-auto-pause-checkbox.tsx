import React, { type ChangeEvent } from "react";
import { Trans } from "@lingui/react/macro";
import { Checkbox } from "csdm/ui/components/inputs/checkbox";
import { useVideoSettings } from "csdm/ui/settings/video/use-video-settings";

export function SmoothPlaybackAutoPauseCheckbox() {
	const { settings, updateSettings } = useVideoSettings();

	const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
		await updateSettings({
			smoothPlaybackAutoPause: event.target.checked,
		});
	};

	return (
		<Checkbox
			label={
				<Trans context="Checkbox label">
					Pause between sequences (CS2 only)
				</Trans>
			}
			onChange={onChange}
			isChecked={settings.smoothPlaybackAutoPause}
		/>
	);
}
