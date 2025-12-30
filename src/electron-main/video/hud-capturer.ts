import { BrowserWindow } from "electron";
import fs from "fs-extra";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";

export class HudCapturer {
	private window: BrowserWindow | null = null;
	private watcher: FSWatcher | null = null;
	private startTime = 0;

	public async start(
		url: string,
		rawFilesFolder: string,
		width: number,
		height: number,
	) {
		try {
			this.startTime = Date.now();
			logger.log(
				`HudCapturer:: Starting capture for ${url} in ${rawFilesFolder} (${width}x${height})`,
			);
			this.window = new BrowserWindow({
				show: false,
				width,
				height,
				transparent: true,
				frame: false,
				webPreferences: {
					offscreen: true,
					contextIsolation: true,
					sandbox: true,
				},
			});

			this.window.setBackgroundColor("#00000000");
			this.window.webContents.setFrameRate(60);

			await this.window.loadURL(url);
			logger.log("HudCapturer:: URL loaded successfully");

			await fs.ensureDir(rawFilesFolder);

			this.watcher = chokidar.watch(rawFilesFolder, {
				persistent: true,
				usePolling: process.platform === "linux",
				interval: 100,
				depth: 5, // More depth to be safe
			});

			this.watcher.on("add", async (filePath: string) => {
				// Only process files created after we started to avoid old garbage
				const stats = await fs.stat(filePath);
				if (stats.mtimeMs < this.startTime - 1000) {
					return;
				}

				const ext = path.extname(filePath).toLowerCase();
				if (ext === ".tga") {
					const hudFilePath = filePath.replace(/\.tga$/i, "_hud.png");

					if (this.window && !this.window.isDestroyed()) {
						try {
							const image = await this.window.webContents.capturePage();
							const buffer = image.toPNG();
							if (buffer.length > 0) {
								await fs.writeFile(hudFilePath, buffer);
							}
						} catch (error) {
							logger.error("HudCapturer:: Failed to capture frame:", error);
						}
					}
				}
			});

			this.watcher.on("error", (error) => {
				logger.error("HudCapturer:: Watcher error:", error);
			});

			this.watcher.on("ready", () => {
				logger.log(
					`HudCapturer:: Watcher is ready and watching ${rawFilesFolder}`,
				);
			});
		} catch (error) {
			logger.error("HudCapturer:: Error during startup:", error);
			throw error;
		}

		return new Promise<void>((resolve) => {
			if (this.window?.webContents.isLoading()) {
				this.window.webContents.once("did-finish-load", () => resolve());
			} else {
				resolve();
			}
		});
	}

	public async stop() {
		logger.log("HudCapturer:: Stopping capture");
		if (this.watcher) {
			await this.watcher.close();
			this.watcher = null;
		}
		if (this.window && !this.window.isDestroyed()) {
			this.window.destroy();
			this.window = null;
		}
	}
}
