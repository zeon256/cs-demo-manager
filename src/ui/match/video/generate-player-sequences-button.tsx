import React, { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { VoiceActivity } from "csdm/common/types/voice-activity";
import { Button } from "csdm/ui/components/buttons/button";
import type { SelectOption } from "csdm/ui/components/inputs/select";
import { Select } from "csdm/ui/components/inputs/select";
import { useCurrentMatch } from "../use-current-match";
import {
	generatePlayersDeathsSequences,
	generatePlayersKillsSequences,
	generatePlayersRoundsSequences,
	generatePlayersRoundsWithTeammatesSequences,
	generatePlayersHighlightsSequences,
} from "./sequences/sequences-actions";
import { RendererClientMessageName } from "csdm/server/renderer-client-message-name";
import { useWebSocketClient } from "csdm/ui/hooks/use-web-socket-client";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "csdm/ui/dialogs/dialog";
import { CancelButton } from "csdm/ui/components/buttons/cancel-button";
import { useDialog } from "csdm/ui/components/dialogs/use-dialog";
import { useDispatch } from "csdm/ui/store/use-dispatch";
import { PlayerSequenceEvent } from "csdm/common/types/player-sequence-event";
import { WeaponsFilter } from "csdm/ui/components/dropdown-filter/weapons-filter";
import { uniqueArray } from "csdm/common/array/unique-array";
import type { Match } from "csdm/common/types/match";
import { ExclamationTriangleIcon } from "csdm/ui/icons/exclamation-triangle-icon";
import type { WeaponName } from "csdm/common/types/counter-strike";
import { Perspective } from "csdm/common/types/perspective";
import { assertNever } from "csdm/common/assert-never";
import { useVideoSettings } from "csdm/ui/settings/video/use-video-settings";
import { SecondsInput } from "csdm/ui/components/inputs/seconds-input";
import { ConfirmButton } from "csdm/ui/components/buttons/confirm-button";
import { PlayersSelect } from "csdm/ui/components/inputs/select/players-select";
import { RoundsSelect } from "csdm/ui/components/inputs/select/rounds-select";
import { Checkbox } from "csdm/ui/components/inputs/checkbox";

function getVisibleWeapons(
	event: PlayerSequenceEvent,
	steamIds: string[],
	match: Match,
) {
	if (steamIds.length === 0) {
		return [];
	}

	const key =
		event === PlayerSequenceEvent.Kills ? "killerSteamId" : "victimSteamId";

	return uniqueArray(
		match.kills
			.filter((kill) => {
				return steamIds.includes(kill[key]);
			})
			.map((kill) => kill.weaponName),
	);
}

function SelectPlayerDialog() {
	const dispatch = useDispatch();
	const client = useWebSocketClient();
	const { t } = useLingui();
	const match = useCurrentMatch();
	const { settings } = useVideoSettings();
	const { hideDialog } = useDialog();
	const options: SelectOption[] = match.players.map((player) => {
		return {
			value: player.steamId,
			label: player.name,
		};
	});
	const eventOptions: SelectOption<PlayerSequenceEvent>[] = [
		{
			value: PlayerSequenceEvent.Kills,
			label: "Kill",
		},
		{
			value: PlayerSequenceEvent.Deaths,
			label: "Death",
		},
		{
			value: PlayerSequenceEvent.Rounds,
			label: "Round",
		},
		{
			value: PlayerSequenceEvent.RoundsWithTeammates,
			label: "Round with teammate switch",
		},
		{
			value: PlayerSequenceEvent.Highlights,
			label: "Smart Highlights",
		},
	];
	const [selectedSteamIds, setSelectedSteamIds] = useState(
		options.length > 0 ? [options[0].value] : [],
	);
	const [selectedEvent, setSelectedEvent] = useState<PlayerSequenceEvent>(
		PlayerSequenceEvent.Kills,
	);
	const [selectedRounds, setSelectedRounds] = useState<number[]>([]);
	const visibleWeapons = getVisibleWeapons(
		selectedEvent,
		selectedSteamIds,
		match,
	);
	const [selectedWeapons, setSelectedWeapons] =
		useState<WeaponName[]>(visibleWeapons);
	const [perspective, setPerspective] = useState<Perspective>(
		Perspective.Player,
	);
	const [startSecondsBeforeEvent, setStartSecondsBeforeEvent] = useState(2);
	const [endSecondsAfterEvent, setEndSecondsAfterEvent] = useState(2);
	const [startSecondsBeforeVoice, setStartSecondsBeforeVoice] = useState(2);
	const [endSecondsAfterVoice, setEndSecondsAfterVoice] = useState(2);
	const [roundStartMargin, setRoundStartMargin] = useState(0);
	const [roundEndMargin, setRoundEndMargin] = useState(0);
	const [preserveExistingSequences, setPreserveExistingSequences] =
		useState(false);
	const [minInterestScore, setMinInterestScore] = useState(25);
	const [includeVoiceChat, setIncludeVoiceChat] = useState(false);
	const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);

	const onConfirm = async () => {
		if (!selectedSteamIds) {
			return;
		}

		switch (selectedEvent) {
			case PlayerSequenceEvent.Deaths:
				dispatch(
					generatePlayersDeathsSequences({
						match,
						perspective,
						steamIds: selectedSteamIds,
						rounds: selectedRounds,
						weapons: selectedWeapons,
						settings,
						startSecondsBeforeEvent,
						endSecondsAfterEvent,
						preserveExistingSequences,
					}),
				);
				break;
			case PlayerSequenceEvent.Kills:
				dispatch(
					generatePlayersKillsSequences({
						match,
						perspective,
						steamIds: selectedSteamIds,
						rounds: selectedRounds,
						weapons: selectedWeapons,
						settings,
						startSecondsBeforeEvent,
						endSecondsAfterEvent,
						preserveExistingSequences,
					}),
				);
				break;
			case PlayerSequenceEvent.Rounds:
				dispatch(
					generatePlayersRoundsSequences({
						match,
						steamIds: selectedSteamIds,
						rounds: selectedRounds,
						settings,
						startSecondsBeforeEvent,
						endSecondsAfterEvent,
						preserveExistingSequences,
					}),
				);
				break;
			case PlayerSequenceEvent.RoundsWithTeammates:
				dispatch(
					generatePlayersRoundsWithTeammatesSequences({
						match,
						steamIds: selectedSteamIds,
						rounds: selectedRounds,
						settings,
						startSecondsBeforeEvent,
						endSecondsAfterEvent,
						preserveExistingSequences,
					}),
				);
				break;
			case PlayerSequenceEvent.Highlights: {
				let voiceActivity: VoiceActivity[] | undefined;
				if (includeVoiceChat) {
					setIsAnalyzingVoice(true);
					try {
						voiceActivity = await client.send({
							name: RendererClientMessageName.FetchMatchVoiceActivity,
							payload: {
								demoFilePath: match.demoFilePath,
								steamIds: selectedSteamIds,
							},
						});
					} catch (error) {
						// Optionally handle error (e.g., show toast)
						console.error("Failed to fetch voice activity", error);
					} finally {
						setIsAnalyzingVoice(false);
					}
				}

				dispatch(
					generatePlayersHighlightsSequences({
						match,
						steamIds: selectedSteamIds,
						rounds: selectedRounds,
						settings,
						preserveExistingSequences,
						minInterestScore,
						secondsBeforeAction: startSecondsBeforeEvent,
						secondsAfterAction: endSecondsAfterEvent,
						voiceActivity,
						secondsBeforeVoice: startSecondsBeforeVoice,
						secondsAfterVoice: endSecondsAfterVoice,
						roundStartMargin,
						roundEndMargin,
					}),
				);
				break;
			}
			default:
				return assertNever(
					selectedEvent,
					`Unknown player sequence event: ${selectedEvent}`,
				);
		}

		hideDialog();
	};

	const renderSelectedEventOptions = () => {
		if (
			selectedEvent === PlayerSequenceEvent.Rounds ||
			selectedEvent === PlayerSequenceEvent.RoundsWithTeammates
		) {
			return (
				<>
					<SecondsInput
						key="round-start-delay"
						label={
							<Trans context="Input label">
								Seconds before the round starts to start the sequence
							</Trans>
						}
						defaultValue={startSecondsBeforeEvent}
						onChange={setStartSecondsBeforeEvent}
					/>
					<SecondsInput
						key="round-end-delay"
						label={
							selectedEvent === PlayerSequenceEvent.Rounds
								? "Seconds after the round ends or the player dies to stop the sequence"
								: "Seconds after the round ends to stop the sequence"
						}
						defaultValue={endSecondsAfterEvent}
						onChange={setEndSecondsAfterEvent}
					/>
				</>
			);
		}

		if (selectedEvent === PlayerSequenceEvent.Highlights) {
			return (
				<>
					<SecondsInput
						key="highlight-start-delay"
						label={
							<Trans context="Input label">
								Seconds before the action to start the sequence
							</Trans>
						}
						defaultValue={startSecondsBeforeEvent}
						onChange={setStartSecondsBeforeEvent}
					/>
					<SecondsInput
						key="highlight-end-delay"
						label={
							<Trans context="Input label">
								Seconds after the action to stop the sequence
							</Trans>
						}
						defaultValue={endSecondsAfterEvent}
						onChange={setEndSecondsAfterEvent}
					/>
					<div className="flex flex-col gap-y-8">
						<label htmlFor="min-interest">
							<Trans context="Input label">Minimum Interest Score</Trans>
						</label>
						<input
							id="min-interest"
							type="number"
							className="bg-gray-100 p-8 rounded"
							value={minInterestScore}
							onChange={(e) =>
								setMinInterestScore(Number.parseInt(e.target.value, 10))
							}
						/>
						<p className="text-caption">
							<Trans>
								Kills = 100, Shots = 25. The generator will group actions close
								to each other.
							</Trans>
						</p>
					</div>

					<SecondsInput
						key="round-start-margin"
						label={
							<Trans context="Input label">Seconds before round start</Trans>
						}
						defaultValue={roundStartMargin}
						onChange={setRoundStartMargin}
					/>
					<SecondsInput
						key="round-end-margin"
						label={<Trans context="Input label">Seconds after round end</Trans>}
						defaultValue={roundEndMargin}
						onChange={setRoundEndMargin}
					/>

					<Checkbox
						label={
							<Trans context="Checkbox label">
								Preserve existing sequences
							</Trans>
						}
						isChecked={preserveExistingSequences}
						onChange={(event) => {
							setPreserveExistingSequences(event.target.checked);
						}}
					/>
					<Checkbox
						label={<Trans context="Checkbox label">Include Voice Chat</Trans>}
						isChecked={includeVoiceChat}
						onChange={(event) => {
							setIncludeVoiceChat(event.target.checked);
						}}
					/>
					{includeVoiceChat && (
						<>
							<SecondsInput
								key="voice-start-delay"
								label={
									<Trans context="Input label">Seconds before voice chat</Trans>
								}
								defaultValue={startSecondsBeforeVoice}
								onChange={setStartSecondsBeforeVoice}
							/>
							<SecondsInput
								key="voice-end-delay"
								label={
									<Trans context="Input label">Seconds after voice chat</Trans>
								}
								defaultValue={endSecondsAfterVoice}
								onChange={setEndSecondsAfterVoice}
							/>
						</>
					)}
				</>
			);
		}

		return (
			<>
				<div className="flex flex-col gap-y-8">
					<label htmlFor="pov">
						<Trans context="Select label">POV</Trans>
					</label>
					<div>
						<Select
							id="pov"
							options={[
								{
									value: Perspective.Player,
									label: <Trans context="Select option">Player</Trans>,
								},
								{
									value: Perspective.Enemy,
									label: <Trans context="Select option">Enemy</Trans>,
								},
							]}
							value={perspective}
							onChange={setPerspective}
						/>
					</div>
				</div>
				<SecondsInput
					label={
						<Trans context="Input label">
							Seconds before each kill to start the sequence
						</Trans>
					}
					defaultValue={startSecondsBeforeEvent}
					onChange={setStartSecondsBeforeEvent}
				/>
				<SecondsInput
					label={
						<Trans context="Input label">
							Seconds after each kill to stop the sequence
						</Trans>
					}
					defaultValue={endSecondsAfterEvent}
					onChange={setEndSecondsAfterEvent}
				/>

				{visibleWeapons.length > 0 ? (
					<WeaponsFilter
						weapons={visibleWeapons}
						selectedWeapons={selectedWeapons}
						hasActiveFilter={
							selectedWeapons.length > 0 &&
							selectedWeapons.length !== visibleWeapons.length
						}
						onChange={(weapons) => {
							setSelectedWeapons(weapons);
						}}
					/>
				) : (
					<p>
						<Trans>No action found for this player</Trans>
					</p>
				)}

				<Checkbox
					label={
						<Trans context="Checkbox label">Preserve existing sequences</Trans>
					}
					isChecked={preserveExistingSequences}
					onChange={(event) => {
						setPreserveExistingSequences(event.target.checked);
					}}
				/>

				<div className="flex items-center gap-x-8">
					<ExclamationTriangleIcon className="size-20 text-orange-700" />
					<p className="text-caption">
						<Trans>
							If 2 actions occurred less than 10 seconds apart or 2 actions are
							less than 2 seconds apart, a single sequence will be generated.
						</Trans>
					</p>
				</div>
			</>
		);
	};

	return (
		<Dialog onEnterPressed={onConfirm}>
			<DialogHeader>
				<DialogTitle>
					<Trans context="Dialog title">Generate player's sequences</Trans>
				</DialogTitle>
			</DialogHeader>
			<DialogContent>
				<div className="flex w-[512px] flex-col gap-y-12">
					<PlayersSelect
						players={match.players}
						selectedSteamIds={selectedSteamIds}
						onChange={(steamIds: string[]) => {
							setSelectedSteamIds(steamIds);
							const selectedWeapons = getVisibleWeapons(
								selectedEvent,
								steamIds,
								match,
							);
							setSelectedWeapons(selectedWeapons);
						}}
					/>

					<div className="flex flex-col gap-y-8">
						<label htmlFor="event">
							<Trans context="Select label">Event</Trans>
						</label>
						<div>
							<Select
								id="event"
								options={eventOptions}
								value={selectedEvent}
								onChange={(event) => {
									setSelectedEvent(event);
									const selectedWeapons = getVisibleWeapons(
										event,
										selectedSteamIds,
										match,
									);
									setSelectedWeapons(selectedWeapons);
									if (
										event === PlayerSequenceEvent.Rounds ||
										event === PlayerSequenceEvent.RoundsWithTeammates ||
										event === PlayerSequenceEvent.Highlights
									) {
										setStartSecondsBeforeEvent(
											event === PlayerSequenceEvent.Highlights ? 2 : 0,
										);
										setEndSecondsAfterEvent(2);
									} else {
										setStartSecondsBeforeEvent(2);
										setEndSecondsAfterEvent(2);
									}
								}}
							/>
						</div>
					</div>
					<RoundsSelect
						rounds={match.rounds}
						selectedRoundNumbers={selectedRounds}
						onChange={setSelectedRounds}
					/>
					{renderSelectedEventOptions()}
				</div>
			</DialogContent>
			<DialogFooter>
				<ConfirmButton onClick={onConfirm} isDisabled={isAnalyzingVoice} />
				<CancelButton onClick={hideDialog} />
			</DialogFooter>
		</Dialog>
	);
}

export function GeneratePlayerSequencesButton() {
	const { showDialog } = useDialog();

	const onClick = () => {
		showDialog(<SelectPlayerDialog />);
	};

	return (
		<Button onClick={onClick}>
			<Trans context="Button">Generate player's sequences</Trans>
		</Button>
	);
}
