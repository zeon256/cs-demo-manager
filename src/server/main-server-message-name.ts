import type {
	SharedServerMessagePayload,
	SharedServerMessageName,
} from "./shared-server-message-name";

// Message names sent from the WebSocket server to the main Electron process.
export const MainServerMessageName = {
	DownloadValveDemoStarted: "download-valve-demo-started",
	DownloadFaceitDemoStarted: "download-faceit-demo-started",
	Download5EPlayDemoStarted: "download-5eplay-demo-started",
	DownloadRenownDemosStarted: "download-renown-demos-started",
	StartHudCapture: "start-hud-capture",
	StopHudCapture: "stop-hud-capture",
} as const;

export type MainServerMessageName =
	| (typeof MainServerMessageName)[keyof typeof MainServerMessageName]
	| SharedServerMessageName;

export interface MainServerMessagePayload extends SharedServerMessagePayload {
	[MainServerMessageName.DownloadValveDemoStarted]: number;
	[MainServerMessageName.DownloadFaceitDemoStarted]: number;
	[MainServerMessageName.Download5EPlayDemoStarted]: number;
	[MainServerMessageName.DownloadRenownDemosStarted]: number;
	[MainServerMessageName.StartHudCapture]: {
		url: string;
		rawFilesFolder: string;
		width: number;
		height: number;
	};
	[MainServerMessageName.StopHudCapture]: void;
}
