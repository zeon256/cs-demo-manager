# UI Development Guide: Adding New Settings

This guide explains how to add new UI elements (like inputs and checkboxes) to the application, specifically within the Video settings and Match Video views.

## 1. Define the Data Structure

First, add your new property to the relevant settings type.

**File:** `src/node/settings/settings.ts`

```typescript
export type VideoSettings = {
    // ... existing properties
    smoothFramerate: number;
    smoothPlaybackAutoPause: boolean; // Add your new property here
};
```

Update any shared types if this data is passed to the backend or other layers.

**File:** `src/common/types/video.ts`

```typescript
export type Video = {
    // ...
    smoothFramerate: number;
    smoothPlaybackAutoPause: boolean;
};
```

## 2. Set Default Values

Provide a default value for your new setting so the application initializes correctly.

**File:** `src/node/settings/default-settings.ts`

```typescript
export const defaultSettings: Settings = {
    video: {
        // ...
        smoothFramerate: 0,
        smoothPlaybackAutoPause: false,
    },
};
```

## 3. Create the UI Component

Create a reusable React component for your setting. Use existing components like `InputNumber` or `Checkbox` from `csdm/ui/components/inputs/`.

**Example: Checkbox Component**
**File:** `src/ui/match/video/my-new-setting-checkbox.tsx`

```tsx
import React, { type ChangeEvent } from "react";
import { Trans } from "@lingui/react/macro";
import { Checkbox } from "csdm/ui/components/inputs/checkbox";
import { useVideoSettings } from "csdm/ui/settings/video/use-video-settings";

export function MyNewSettingCheckbox() {
  const { settings, updateSettings } = useVideoSettings();

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await updateSettings({
      myNewSetting: event.target.checked,
    });
  };

  return (
    <Checkbox
      label={<Trans>Enable awesome feature</Trans>}
      onChange={onChange}
      isChecked={settings.myNewSetting}
    />
  );
}
```

## 4. Integrate into the View

Add your component to the relevant page (e.g., the Match Video tab).

**File:** `src/ui/match/video/video.tsx`

```tsx
import { MyNewSettingCheckbox } from "./my-new-setting-checkbox";

// ... inside the component
<div className="flex flex-col gap-y-8">
    <MyNewSettingCheckbox />
</div>
```

## 5. Handle Translations

The project uses **LinguiJS** for internationalization. After adding new text in a `<Trans>` tag or using the `t` macro, you must extract the strings.

1. Run the extraction command:
   ```bash
   npm run i18n:extract
   ```
2. Open the translation file (e.g., `src/ui/translations/en/messages.po`) and verify/edit the text if needed.
3. The "jumbled" text (e.g., `Tr1oWm`) is a sign that the translation catalog needs to be updated and recompiled.

## 7. Backend Integration

If your setting needs to affect how the game is launched or how files are generated (like adding console commands):

1.  **Update Parameters**: Add the property to the `Parameters` type in the generation logic (e.g., `src/node/video/generation/watch-video-sequences.ts`).
2.  **Pass the Data**: Ensure the data is passed from the entry point (`watchVideoSequences`) to the generator functions (`createCs2VideoJsonFile`).
3.  **Implement Logic**: Use the flag in the generator to conditionally add console commands:
    ```typescript
    if (settings.myNewSetting) {
        json.addExecCommand(tick, "my_cool_command 1");
    }
    ```

## 8. Build and Verify

To see your changes in the packaged application:

```bash
npm run build
npm run package:dir
```
Then run the executable from `dist/linux-unpacked/cs-demo-manager`.
