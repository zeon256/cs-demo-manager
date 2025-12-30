import React from "react";
import { useVideoSettings } from "csdm/ui/settings/video/use-video-settings";
import { SettingsEntry } from "csdm/ui/settings/settings-entry";
import { Switch } from "csdm/ui/components/inputs/switch";
import { TextInput } from "csdm/ui/components/inputs/text-input";
import { ChangeButton } from "csdm/ui/components/buttons/change-button";
import { ResetButton } from "csdm/ui/components/buttons/reset-button";
import { Select, type SelectOption } from "csdm/ui/components/inputs/select";

export function HudOverlay() {
	const { settings, updateSettings } = useVideoSettings();

	const onBrowseClick = async () => {
		const { filePaths, canceled } = await window.csdm.showOpenDialog({
			properties: ["openFile"],
			filters: [
				{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
			],
		});

		if (canceled || filePaths.length === 0) {
			return;
		}

		updateSettings({ hudOverlayFilePath: filePaths[0] });
	};

	const onResetClick = () => {
		updateSettings({ hudOverlayFilePath: "" });
	};

	const typeOptions: SelectOption<"file" | "url">[] = [
		{ label: "Video File", value: "file" },
		{ label: "Web URL (GSI ready)", value: "url" },
	];

	return (
		<>
			<SettingsEntry
				interactiveComponent={
					<Switch
						isChecked={settings.hudOverlayEnabled}
						onChange={(isChecked) => {
							updateSettings({ hudOverlayEnabled: isChecked });
						}}
					/>
				}
				description={
					<p>
						Overlay a video file or a web-based HUD on top of the game
						recording.
					</p>
				}
				title="HUD Overlay"
			/>
			{settings.hudOverlayEnabled && (
				<>
					<SettingsEntry
						interactiveComponent={
							<Select
								value={settings.hudOverlayType}
								options={typeOptions}
								onChange={(value) => {
									updateSettings({ hudOverlayType: value });
								}}
							/>
						}
						description={
							<p>
								Choose between a local video file or a live web HUD (useful for
								GSI-driven HUDs).
							</p>
						}
						title="Overlay Type"
					/>
					{settings.hudOverlayType === "file" ? (
						<SettingsEntry
							interactiveComponent={
								<div className="flex items-center gap-x-8">
									<TextInput
										value={settings.hudOverlayFilePath}
										isReadOnly={true}
										placeholder="Path to HUD video file"
									/>
									<ChangeButton onClick={onBrowseClick} />
									<ResetButton
										onClick={onResetClick}
										isDisabled={settings.hudOverlayFilePath === ""}
									/>
								</div>
							}
							description={
								<p>
									A transparent video file to overlay. Usually recorded with an
									alpha channel (e.g., Apple ProRes 4444 or VP9 with alpha).
								</p>
							}
							title="HUD Video Path"
						/>
					) : (
						<SettingsEntry
							interactiveComponent={
								<TextInput
									value={settings.hudOverlayUrl}
									onChange={(event) => {
										updateSettings({ hudOverlayUrl: event.target.value });
									}}
									placeholder="http://localhost:1349/api/hud"
								/>
							}
							description={
								<p>
									The URL of your web HUD. CSDM will automatically capture it
									during the recording process.
								</p>
							}
							title="HUD URL"
						/>
					)}
				</>
			)}
		</>
	);
}
