import React from "react";
import { useSequenceForm } from "./use-sequence-form";
import { ShowHudCheckbox } from "../show-hud-checkbox";

export function SequenceShowHudCheckbox() {
	const { sequence, updateSequence } = useSequenceForm();

	const onChange = (isChecked: boolean) => {
		updateSequence({
			showHud: isChecked,
		});
	};

	return <ShowHudCheckbox onChange={onChange} isChecked={sequence.showHud} />;
}
