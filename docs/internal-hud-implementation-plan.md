# Implementation Plan: Internal Ultralight HUD for HLAE

This document outlines the architecture and implementation plan for a custom HUD overlay built with **Ultralight (React/JS)** that integrates directly into the **HLAE recording pipeline**.

---

## 1. Goal
Create a DLL-injected HUD that renders inside the game process so it is captured by HLAE's `mirv_recording` command. This ensures the HUD is included in the high-quality, fixed-framerate TGA/MP4 output.

## 2. Architecture Overview

### Component stack:
1.  **React App**: The UI layer (HTML/CSS/JS).
2.  **Ultralight Renderer**: A headless C++ browser engine that converts WebKit output to a GPU texture.
3.  **D3D11 Hook DLL**: A C++ library that hooks the game's graphics API to "blit" the Ultralight texture.
4.  **HLAE Integration**: Uses HLAE's loader to inject the custom DLL alongside `AfxHookSource2.dll`.

---

## 3. Detailed Implementation Steps

### Phase 1: The Graphics Hook (C++)
To render inside the game, the DLL must hook into **DirectX 11 (CS2)**.
- **API Hooking**: Use a library like `MinHook` to intercept `IDXGISwapChain::Present`.
- **Rendering Context**:
    - On the first call to `Present`, retrieve the `ID3D11Device` and `ID3D11DeviceContext`.
    - Create a "Full-screen Quad" or a SpriteBatch to render a texture over the game.
- **HLAE Capture Point**: Ensure the HUD is drawn *before* the original `Present` call. Since HLAE hooks at a similar level, your hook must be compatible.

### Phase 2: Ultralight Integration
- **Off-screen Rendering**: Configure Ultralight to use an off-screen surface.
- **Load URL**: Point the Ultralight View to the local CSDM API: `http://localhost:1349/api/hud`.
- **Texture Mapping**: 
    - Convert Ultralight's pixel buffer to a `ID3D11Texture2D`.
    - Set up a Shader Resource View (SRV) so the texture can be used in your D3D11 draw calls.
- **Input Handling**: (Optional) Forward Windows messages (`WM_MOUSEMOVE`, etc.) to Ultralight if interaction is needed during setup.

### Phase 3: Synchronized Frame Timing (Critical)
HLAE recordings use `host_framerate`. If the game renders at 1 FPS while saving frames, a standard 60 FPS React animation will play 60x too fast.
- **Manual Clock**: Disable Ultralight's internal timer.
- **Tick Sync**: 
    - Inside the `Present` hook, calculate the "game time" based on the frame count: `time = frameIndex / recordingFPS`.
    - Call `Renderer::Update(time)` and `Renderer::Refresh()` manually.
- **Result**: Your React animations (CSS transitions, GSAP, etc.) will be perfectly synchronized with the recorded footage.

### Phase 4: Data Bridge (React ⟷ Game)
To get health, ammo, and killfeed data into React:
- **Option A: GSI (Recommended)**: 
    - Use Counter-Strike's Game State Integration.
    - Run a tiny HTTP listener inside your C++ DLL.
    - When GSI data arrives, execute JS in Ultralight: `view->EvaluateScript("updateHUD({...})")`.
- **Option B: WebSockets**: Have the React app connect to a local socket hosted by the DLL.

---

## 4. Launch Workflow
1.  **Prepare Assets**: Build the React app and place the files in a folder accessible by the DLL.
2.  **HLAE Configuration**:
    - Launch HLAE GUI or use CSDM command line.
    - Add `YourHUD.dll` to the "DLLs to inject" list.
    - Ensure `-insecure` is in the launch options.
3.  **Start Recording**: 
    - Load the demo.
    - Run `mirv_recording start`.
    - The custom HUD will appear in the output frames.

## 5. Security Note
**NEVER** use this on VAC-secured servers. Always use the `-insecure` flag. DLL injection into CS2 is a primary trigger for VAC bans. This architecture is strictly for **Movie Making** and **Demo Review**.
