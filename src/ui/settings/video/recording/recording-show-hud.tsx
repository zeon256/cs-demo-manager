import React from "react";
import { Trans } from "@lingui/react/macro";
import { useVideoSettings } from "csdm/ui/settings/video/use-video-settings";
import { SettingsEntry } from "csdm/ui/settings/settings-entry";
import { Switch } from "csdm/ui/components/inputs/switch";

export function RecordingShowHud() {
	const { settings, updateSettings } = useVideoSettings();

	return (
		<SettingsEntry
			interactiveComponent={
				<Switch
					isChecked={settings.showHud}
					onChange={(isChecked) => {
						updateSettings({ showHud: isChecked });
					}}
				/>
			}
			description={
				<p>
					<Trans>Show the in-game HUD.</Trans>
				</p>
			}
			title={<Trans context="Settings title">Show HUD</Trans>}
		/>
	);
}
