#pragma once
#include <d3d11.h>

class HudRenderer {
public:
    HudRenderer();
    ~HudRenderer();

    // Initialize Ultralight and D3D11 resources
    bool Initialize(ID3D11Device* device, ID3D11DeviceContext* context);
    
    // Updates internal logic (Ultralight update)
    void Update();

    // Renders the HUD overlay
    void Render(ID3D11DeviceContext* context, IDXGISwapChain* swapChain);

    // Shutdown and cleanup
    void Shutdown();

private:
    bool initialized_ = false;
    ID3D11Device* device_ = nullptr;
    // We will add Ultralight members in the implementation
};

// Global instance access if needed, or manage via hooks
extern HudRenderer* g_Renderer;
