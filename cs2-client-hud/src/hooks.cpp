#include "hooks.h"
#include <d3d11.h>
#include <dxgi.h>
#include <MinHook.h>
#include <cstdio>
#include "renderer.h"
#include "debug_log.h" 
#include <string>

// Tyedefs for the function signature
typedef HRESULT(__fastcall* IDXGISwapChain_Present_t)(IDXGISwapChain* pSwapChain, UINT SyncInterval, UINT Flags);

// Original function pointer
IDXGISwapChain_Present_t oPresent = nullptr;

// Global renderer instance
HudRenderer* g_Renderer = nullptr;

// Hook function
HRESULT __fastcall hkPresent(IDXGISwapChain* pSwapChain, UINT SyncInterval, UINT Flags) {
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;

    if (SUCCEEDED(pSwapChain->GetDevice(__uuidof(ID3D11Device), (void**)&device))) {
        device->GetImmediateContext(&context);
        
        static bool init = false;
        if (!init) {
            Log("hkPresent: Initializing Renderer...");
            if (g_Renderer && g_Renderer->Initialize(device, context)) {
                Log("hkPresent: Renderer Initialized.");
                init = true;
            } else {
                Log("hkPresent: Renderer Init Failed.");
            }
        }

        if (init && g_Renderer) {
            g_Renderer->Update();
            g_Renderer->Render(context, pSwapChain);
        }

        // Log("hkPresent: Releasing context...");
        context->Release();
        // Log("hkPresent: Releasing device...");
        device->Release();
    }

    // Log("hkPresent: Calling oPresent...");
    return oPresent(pSwapChain, SyncInterval, Flags);
}

// Helper to find Present address
void* GetPresentAddress() {
    DXGI_SWAP_CHAIN_DESC sd;
    ZeroMemory(&sd, sizeof(sd));
    sd.BufferCount = 1;
    sd.BufferDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    sd.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    sd.OutputWindow = GetForegroundWindow(); // Just for dummy creation
    sd.SampleDesc.Count = 1;
    sd.Windowed = TRUE;
    sd.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;

    if (sd.OutputWindow == NULL) {
        // Fallback or error?
        // We can just create a temporary window class
        WNDCLASSEX wc = { sizeof(WNDCLASSEX), CS_HREDRAW | CS_VREDRAW, DefWindowProc, 0, 0, GetModuleHandle(NULL), NULL, NULL, NULL, NULL, "CS2HooksTemp", NULL };
        RegisterClassEx(&wc);
        sd.OutputWindow = CreateWindow(wc.lpszClassName, "CS2 Hooks Temp", WS_OVERLAPPEDWINDOW, 0, 0, 100, 100, NULL, NULL, wc.hInstance, NULL);
    }

    D3D_FEATURE_LEVEL featureLevel = D3D_FEATURE_LEVEL_11_0;
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    IDXGISwapChain* swapChain = nullptr;

    if (FAILED(D3D11CreateDeviceAndSwapChain(NULL, D3D_DRIVER_TYPE_HARDWARE, NULL, 0, &featureLevel, 1, D3D11_SDK_VERSION, &sd, &swapChain, &device, NULL, &context))) {
        // Try reference driver if hardware fails (unlikely in game, but safety)
        D3D11CreateDeviceAndSwapChain(NULL, D3D_DRIVER_TYPE_WARP, NULL, 0, &featureLevel, 1, D3D11_SDK_VERSION, &sd, &swapChain, &device, NULL, &context);
    }

    if (swapChain) {
        // vtable[8] is Present
        void** vtable = *(void***)swapChain;
        void* address = vtable[8];

        swapChain->Release();
        device->Release();
        context->Release();
        return address;
    }

    return nullptr;
}

#include "debug_log.h"

bool InstallHooks() {
    Log("Initializing MinHook...");
    if (MH_Initialize() != MH_OK) {
        Log("MinHook initialization failed.");
        return false;
    }

    // Initialize Renderer Instance
    g_Renderer = new HudRenderer();

    Log("Getting Present address...");
    void* presentAddr = GetPresentAddress();
    if (!presentAddr) {
        Log("Failed to get Present address.");
        return false;
    }
    Log("Present address found.");

    if (MH_CreateHook(presentAddr, &hkPresent, (LPVOID*)&oPresent) != MH_OK) {
        Log("MH_CreateHook failed.");
        return false;
    }

    if (MH_EnableHook(MH_ALL_HOOKS) != MH_OK) {
        Log("MH_EnableHook failed.");
        return false;
    }

    Log("Hooks enabled successfully.");
    return true;
}

void RemoveHooks() {
    Log("Removing hooks...");
    MH_DisableHook(MH_ALL_HOOKS);
    MH_Uninitialize();
    
    if (g_Renderer) {
        g_Renderer->Shutdown();
        delete g_Renderer;
        g_Renderer = nullptr;
    }
}
