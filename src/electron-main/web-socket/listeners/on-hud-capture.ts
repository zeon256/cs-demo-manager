import { HudCapturer } from "../../video/hud-capturer";
import type {
	MainServerMessagePayload,
	MainServerMessageName,
} from "csdm/server/main-server-message-name";
import type { WebSocketClient } from "../web-socket-client";

let hudCapturer: HudCapturer | null = null;

export async function onStartHudCapture(
	client: WebSocketClient,
	payload: MainServerMessagePayload["start-hud-capture"],
) {
	if (hudCapturer !== null) {
		hudCapturer.stop();
	}

	hudCapturer = new HudCapturer();
	await hudCapturer.start(
		payload.url,
		payload.rawFilesFolder,
		payload.width,
		payload.height,
	);
}

export async function onStopHudCapture(client: WebSocketClient) {
	if (hudCapturer !== null) {
		await hudCapturer.stop();
		hudCapturer = null;
	}
}
