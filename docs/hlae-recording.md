# HLAE Recording on Windows

HLAE (Half-Life Advanced Effects) is the core tool used by CS Demo Manager for advanced video recording and cinematic effects in Counter-Strike 2 and CS:GO. This document explains how HLAE functions and how it integrates with CSDM on Windows.

## Core Mechanism: DLL Injection

HLAE operates primarily through **DLL (Dynamic Link Library) Injection**. When you launch a game through HLAE, it acts as an injector that forces the game process to load a custom HLAE library.

- **For CS2**: It injects `AfxHookSource2.dll` (located in the `x64` folder of your HLAE installation).
- **For CS:GO**: It injects `AfxHookSource.dll`.

### How it works technicaly:
1. **Process Creation**: HLAE starts the game process (e.g., `cs2.exe`) in a suspended state or hooks it immediately after creation.
2. **Memory Allocation**: It uses Windows API functions (like `VirtualAllocEx`) to allocate space within the game's memory.
3. **Triggering Load**: It uses `CreateRemoteThread` or similar techniques to call `LoadLibrary` inside the game process, pointing to the HLAE DLL.
4. **Hooking**: Once loaded, the DLL "hooks" into the game engine's internal functions (DirectX/Vulkan rendering, input handling, etc.). This allows HLAE to intercept and modify how the game renders frames, manages the camera, and processes console commands.

## How CSDM Integrates with HLAE

CS Demo Manager automates the complex setup required for HLAE recording.

### 1. Launching the Game
CSDM executes the HLAE binary with specific command-line arguments to automate the injection process without the user needing to interact with the HLAE GUI.
- It uses `-customLoader` for CS:2.
- It passes `-hookDllPath` to point to the correct `AfxHookSource2.dll`.
- It includes `-insecure` to ensure the game doesn't connect to VAC-secured servers, protecting your account from bans due to the injection.

### 2. FFmpeg Integration
HLAE can record directly to video files using FFmpeg. CSDM manages this by:
- Creating/updating an `ffmpeg.ini` file in the HLAE folder to tell HLAE where your FFmpeg executable is located.
- Sending `mirv_recording` commands via the game console to start and stop the capture.

### 3. Automated Commands (`mirv_`)
HLAE introduces a vast array of console commands starting with `mirv_`. CSDM automatically generates and sends these commands to:
- Control the camera (smooth paths, FOV).
- Hide/Show HUD elements.
- Manage the recording state (framerate, start/stop).
- Handle advanced effects like motion blur through high-framerate sampling.

## Recording Process Flow
1. **Setup**: CSDM prepares the sequence data and ensures HLAE/FFmpeg are installed.
2. **Injection**: HLAE launches the game and injects the hook DLL.
3. **Execution**: CSDM sends commands to the game to play the demo and start recording at a fixed framerate.
4. **Capture**: HLAE captures each frame at the requested framerate (often slowing down the demo playback to ensure every frame is captured perfectly, even if the hardware is slow).
5. **Encoding**: The captured frames are passed to FFmpeg to generate the final `.mp4` or `.avi` file.

## Why "Insecure" Mode?
Because DLL injection is a technique also used by cheats, Valve Anti-Cheat (VAC) would flag HLAE as a malicious tool if used on secured servers. HLAE and CSDM **always** use the `-insecure` launch flag to disable VAC, making it safe to use for recording demos offline.
