import React from "react";
import { Trans } from "@lingui/react/macro";
import { Checkbox } from "csdm/ui/components/inputs/checkbox";

type Props = {
	isChecked: boolean;
	onChange: (isChecked: boolean) => void;
};

export function ShowHudCheckbox({ isChecked, onChange }: Props) {
	return (
		<Checkbox
			label={<Trans context="Input label">Show HUD</Trans>}
			isChecked={isChecked}
			onChange={(event) => {
				onChange(event.target.checked);
			}}
		/>
	);
}
