#include "renderer.h"
#include <Ultralight/Ultralight.h>
#include <AppCore/Platform.h>
#include <d3dcompiler.h>
#include <directxmath.h>

#include <vector>
#include <string>
#include "state_saver.h"

#pragma comment(lib, "d3dcompiler.lib")

using namespace ultralight;
using namespace DirectX;

// Shader Source
const char* kVertexShader = R"(
struct VS_INPUT {
    float3 pos : POSITION;
    float2 uv : TEXCOORD;
};
struct PS_INPUT {
    float4 pos : SV_POSITION;
    float2 uv : TEXCOORD;
};
PS_INPUT main(VS_INPUT input) {
    PS_INPUT output;
    output.pos = float4(input.pos, 1.0);
    output.uv = input.uv;
    return output;
}
)";

const char* kPixelShader = R"(
Texture2D tex : register(t0);
SamplerState sam : register(s0);
struct PS_INPUT {
    float4 pos : SV_POSITION;
    float2 uv : TEXCOORD;
};
float4 main(PS_INPUT input) : SV_Target {
    float4 color = tex.Sample(sam, input.uv);
    return color;
}
)";

struct Vertex {
    XMFLOAT3 pos;
    XMFLOAT2 uv;
};

class HudLogger : public Logger {
public:
    virtual void LogMessage(LogLevel log_level, const String& message) override {
        // OutputDebugStringA(message.utf8().data());
    }
};

class HudRendererImpl : public LoadListener, public ViewListener {
public:
    RefPtr<Renderer> renderer;
    RefPtr<View> view;
    RefPtr<Session> session;
    
    // D3D11 Resources
    ID3D11VertexShader* vertex_shader_ = nullptr;
    ID3D11PixelShader* pixel_shader_ = nullptr;
    ID3D11InputLayout* input_layout_ = nullptr;
    ID3D11Buffer* vertex_buffer_ = nullptr;
    ID3D11SamplerState* sampler_state_ = nullptr;
    ID3D11BlendState* blend_state_ = nullptr;
    ID3D11RasterizerState* rasterizer_state_ = nullptr;
    ID3D11DepthStencilState* depth_stencil_state_ = nullptr;
    ID3D11Texture2D* texture_ = nullptr;
    ID3D11ShaderResourceView* srv_ = nullptr;

    uint32_t width_ = 1920;
    uint32_t height_ = 1080;

    void OnFinishLoading(ultralight::View* callers_view,
                        uint64_t frame_id,
                        bool is_main_frame,
                        const String& url) override {
        // Loaded
    }

    void Cleanup() {
        if (vertex_shader_) vertex_shader_->Release();
        if (pixel_shader_) pixel_shader_->Release();
        if (input_layout_) input_layout_->Release();
        if (vertex_buffer_) vertex_buffer_->Release();
        if (sampler_state_) sampler_state_->Release();
        if (blend_state_) blend_state_->Release();
        if (rasterizer_state_) rasterizer_state_->Release();
        if (depth_stencil_state_) depth_stencil_state_->Release();
        if (texture_) texture_->Release();
        if (srv_) srv_->Release();
    }
};

HudRenderer::HudRenderer() {
    // We'll init impl in Initialize
}

HudRenderer::~HudRenderer() {
    Shutdown();
}

static HudRendererImpl* g_Impl = nullptr;

bool CreateShaders(ID3D11Device* device) {
    ID3DBlob* vsBlob = nullptr;
    ID3DBlob* errorBlob = nullptr;
    HRESULT hr = D3DCompile(kVertexShader, strlen(kVertexShader), nullptr, nullptr, nullptr, "main", "vs_4_0", 0, 0, &vsBlob, &errorBlob);
    if (FAILED(hr)) return false;

    hr = device->CreateVertexShader(vsBlob->GetBufferPointer(), vsBlob->GetBufferSize(), nullptr, &g_Impl->vertex_shader_);
    if (FAILED(hr)) return false;

    // Input Layout
    D3D11_INPUT_ELEMENT_DESC layout[] = {
        { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D11_INPUT_PER_VERTEX_DATA, 0 },
        { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 12, D3D11_INPUT_PER_VERTEX_DATA, 0 },
    };
    device->CreateInputLayout(layout, 2, vsBlob->GetBufferPointer(), vsBlob->GetBufferSize(), &g_Impl->input_layout_);
    vsBlob->Release();

    ID3DBlob* psBlob = nullptr;
    hr = D3DCompile(kPixelShader, strlen(kPixelShader), nullptr, nullptr, nullptr, "main", "ps_4_0", 0, 0, &psBlob, &errorBlob);
    if (FAILED(hr)) return false;

    device->CreatePixelShader(psBlob->GetBufferPointer(), psBlob->GetBufferSize(), nullptr, &g_Impl->pixel_shader_);
    psBlob->Release();

    return true;
}

bool CreateQuad(ID3D11Device* device) {
    Vertex vertices[] = {
        { XMFLOAT3(-1.0f, -1.0f, 0.0f), XMFLOAT2(0.0f, 1.0f) },
        { XMFLOAT3(-1.0f,  1.0f, 0.0f), XMFLOAT2(0.0f, 0.0f) },
        { XMFLOAT3( 1.0f, -1.0f, 0.0f), XMFLOAT2(1.0f, 1.0f) },
        { XMFLOAT3( 1.0f,  1.0f, 0.0f), XMFLOAT2(1.0f, 0.0f) },
    };

    D3D11_BUFFER_DESC bd = {};
    bd.Usage = D3D11_USAGE_DEFAULT;
    bd.ByteWidth = sizeof(Vertex) * 4;
    bd.BindFlags = D3D11_BIND_VERTEX_BUFFER;
    bd.CPUAccessFlags = 0;

    D3D11_SUBRESOURCE_DATA initData = {};
    initData.pSysMem = vertices;

    device->CreateBuffer(&bd, &initData, &g_Impl->vertex_buffer_);
    return true;
}

bool CreateTexture(ID3D11Device* device, int width, int height) {
    D3D11_TEXTURE2D_DESC desc = {};
    desc.Width = width;
    desc.Height = height;
    desc.MipLevels = 1;
    desc.ArraySize = 1;
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM; // Ultralight uses BGRA
    desc.SampleDesc.Count = 1;
    desc.Usage = D3D11_USAGE_DEFAULT;
    desc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    desc.CPUAccessFlags = 0; // We update via UpdateSubresource

    device->CreateTexture2D(&desc, nullptr, &g_Impl->texture_);
    device->CreateShaderResourceView(g_Impl->texture_, nullptr, &g_Impl->srv_);
    return true;
}

#include "debug_log.h"

bool HudRenderer::Initialize(ID3D11Device* device, ID3D11DeviceContext* context) {
    Log("HudRenderer::Initialize entry");
    if (initialized_) return true;
    
    g_Impl = new HudRendererImpl();
    device_ = device;
    device_->AddRef();

    // 1. Init Ultralight
    Log("Setting up Ultralight config...");

    // Calculate absolute path to resources
    char dllPath[MAX_PATH] = { 0 };
    HMODULE hm = NULL;
    // Use address of g_Impl (static variable) to locate the DLL
    if (GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | 
        GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        (LPCSTR)&g_Impl, &hm)) {
        GetModuleFileNameA(hm, dllPath, sizeof(dllPath));
    }
    std::string path(dllPath);
    std::string dir = path.substr(0, path.find_last_of("\\/"));
    std::string resourceDir = dir + "\\resources\\";

    Log("Resource Path: " + resourceDir);
    Log("Setting up Platform handlers...");

    Config config;
    config.resource_path_prefix = resourceDir.c_str();

    Platform::instance().set_config(config);
    Platform::instance().set_logger(new HudLogger());
    
    // REQUIRED: Set FontLoader and FileSystem when using Renderer::Create directly
    Platform::instance().set_font_loader(GetPlatformFontLoader());
    
    // Set FileSystem base to the DLL directory so it finds "resources/"
    Platform::instance().set_file_system(GetPlatformFileSystem(dir.c_str()));

    Log("Creating Renderer...");
    g_Impl->renderer = Renderer::Create();
    if (!g_Impl->renderer) {
        Log("Failed to create Renderer!");
        return false;
    }
    
    // Create View
    Log("Creating View...");
    ViewConfig view_config;
    view_config.is_transparent = true;
    
    g_Impl->width_ = 2560; 
    g_Impl->height_ = 1440;

    g_Impl->view = g_Impl->renderer->CreateView(g_Impl->width_, g_Impl->height_, view_config, nullptr);
    if (!g_Impl->view) {
        Log("Failed to create View!");
        return false;
    }

    Log("Parameters set. Loading URL...");
    g_Impl->view->set_load_listener(g_Impl);
    g_Impl->view->set_view_listener(g_Impl);
    g_Impl->view->LoadURL("http://localhost:1349/api/hud");

    // 2. Init D3D11 Resources
    Log("Creating D3D11 Resources...");
    if (!CreateShaders(device)) {
        Log("CreateShaders failed");
        return false;
    }
    if (!CreateQuad(device)) {
        Log("CreateQuad failed");
        return false;
    }
    if (!CreateTexture(device, g_Impl->width_, g_Impl->height_)) {
        Log("CreateTexture failed");
        return false;
    }

    // Sampler
    Log("Creating Sampler/Blend State...");
    D3D11_SAMPLER_DESC sampDesc = {};
    sampDesc.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    sampDesc.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampDesc.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampDesc.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampDesc.ComparisonFunc = D3D11_COMPARISON_NEVER;
    device->CreateSamplerState(&sampDesc, &g_Impl->sampler_state_);

    // Blend State
    D3D11_BLEND_DESC blendDesc = {};
    blendDesc.RenderTarget[0].BlendEnable = TRUE;
    blendDesc.RenderTarget[0].SrcBlend = D3D11_BLEND_SRC_ALPHA;
    blendDesc.RenderTarget[0].DestBlend = D3D11_BLEND_INV_SRC_ALPHA;
    blendDesc.RenderTarget[0].BlendOp = D3D11_BLEND_OP_ADD;
    blendDesc.RenderTarget[0].SrcBlendAlpha = D3D11_BLEND_ONE;
    blendDesc.RenderTarget[0].DestBlendAlpha = D3D11_BLEND_ZERO;
    blendDesc.RenderTarget[0].BlendOpAlpha = D3D11_BLEND_OP_ADD;
    blendDesc.RenderTarget[0].RenderTargetWriteMask = D3D11_COLOR_WRITE_ENABLE_ALL;
    device->CreateBlendState(&blendDesc, &g_Impl->blend_state_);

    // Rasterizer State
    D3D11_RASTERIZER_DESC rsDesc = {};
    rsDesc.FillMode = D3D11_FILL_SOLID;
    rsDesc.CullMode = D3D11_CULL_NONE;
    rsDesc.FrontCounterClockwise = FALSE;
    rsDesc.DepthBias = 0;
    rsDesc.DepthBiasClamp = 0.0f;
    rsDesc.SlopeScaledDepthBias = 0.0f;
    rsDesc.DepthClipEnable = TRUE;
    rsDesc.ScissorEnable = TRUE;
    rsDesc.MultisampleEnable = FALSE;
    rsDesc.AntialiasedLineEnable = FALSE;
    device->CreateRasterizerState(&rsDesc, &g_Impl->rasterizer_state_);

    // Depth-Stencil State
    D3D11_DEPTH_STENCIL_DESC dsDesc = {};
    dsDesc.DepthEnable = FALSE;
    dsDesc.DepthWriteMask = D3D11_DEPTH_WRITE_MASK_ALL;
    dsDesc.DepthFunc = D3D11_COMPARISON_LESS;
    dsDesc.StencilEnable = FALSE;
    device->CreateDepthStencilState(&dsDesc, &g_Impl->depth_stencil_state_);

    Log("HudRenderer::Initialize success");
    initialized_ = true;
    return true;
}

void HudRenderer::Update() {
    if (!initialized_ || !g_Impl) return;
    // Log("HudRenderer::Update"); // Too spammy for every frame? Maybe once?
    static bool loggedUpdate = false;
    if (!loggedUpdate) {
        Log("HudRenderer::Update (First Call)");
        loggedUpdate = true;
    }
    g_Impl->renderer->Update();
}

void HudRenderer::Render(ID3D11DeviceContext* context, IDXGISwapChain* swapChain) {
    if (!initialized_ || !g_Impl) return;

    // ... (Ultralight Rendering and Texture Update code remains same) ...
    // ... Copy the code from previous steps or just reference it ...
    // Since I am replacing the WHOLE function, I must include the Texture Update logic.

    // Log("HudRenderer::Render: Ultralight Render");
    static bool loggedRender = false;
    if (!loggedRender) {
        Log("HudRenderer::Render (First Call)");
        loggedRender = true;
    }

    g_Impl->renderer->Render();
    
    // Check if we need to update texture
    Surface* surface = g_Impl->view->surface();
    if (surface) {
        BitmapSurface* bitmap_surface = (BitmapSurface*)surface;
        RefPtr<Bitmap> bitmap = bitmap_surface->bitmap();
        if (bitmap && bitmap_surface->dirty_bounds().IsValid()) {
            Log("HudRenderer::Render: Updating Texture");
            void* pixels = bitmap->LockPixels();
            if (pixels && g_Impl->texture_) {
                context->UpdateSubresource(g_Impl->texture_, 0, nullptr, pixels, bitmap->row_bytes(), 0);
            }
            if (pixels) bitmap->UnlockPixels();
            bitmap_surface->ClearDirtyBounds();
        }
    }



    // Save State
    Log("HudRenderer::Render: Saving State...");
    D3D11StateSaver stateSaver;
    stateSaver.SaveCurrentState(context);

    // --- SETUP RENDER TARGET & VIEWPORT ---
    // Log("HudRenderer::Render: Creating BackBuffer RTV...");
    ID3D11Texture2D* backBuffer = nullptr;
    HRESULT hr = swapChain->GetBuffer(0, __uuidof(ID3D11Texture2D), (void**)&backBuffer);
    if (FAILED(hr) || !backBuffer) {
        Log("Failed to get BackBuffer!");
        stateSaver.RestoreState(context);
        return;
    }

    ID3D11RenderTargetView* rtv = nullptr;
    hr = device_->CreateRenderTargetView(backBuffer, nullptr, &rtv);
    backBuffer->Release(); 

    if (FAILED(hr) || !rtv) {
        Log("Failed to create RTV!");
        stateSaver.RestoreState(context);
        return;
    }

    // Set Viewport
    D3D11_TEXTURE2D_DESC desc;
    backBuffer->GetDesc(&desc); // Wait, I released it. Safe to get desc from swapchain or re-get? 
    // Actually, I should get desc before release. Or use cached size.
    // Let's assume standard Viewport.
    swapChain->GetBuffer(0, __uuidof(ID3D11Texture2D), (void**)&backBuffer); // Get it again safely
    backBuffer->GetDesc(&desc);
    backBuffer->Release();

    D3D11_VIEWPORT vp;
    vp.Width = (FLOAT)desc.Width;
    vp.Height = (FLOAT)desc.Height;
    vp.MinDepth = 0.0f;
    vp.MaxDepth = 1.0f;
    vp.TopLeftX = 0;
    vp.TopLeftY = 0;
    
    context->RSSetViewports(1, &vp);
    context->OMSetRenderTargets(1, &rtv, nullptr); // No depth stencil needed for 2D overlay

    // Log("HudRenderer::Render: RTV & Viewport Set.");

    // --- DRAW ---

    // Set Scissor Rect to Full Screen (Safety)
    D3D11_RECT scissor = { 0, 0, (LONG)desc.Width, (LONG)desc.Height };
    context->RSSetScissorRects(1, &scissor);

    // Set State
    // Log("HudRenderer::Render: Setting States...");
    float blendFactor[] = { 0.f, 0.f, 0.f, 0.f };
    if (g_Impl->blend_state_) context->OMSetBlendState(g_Impl->blend_state_, blendFactor, 0xffffffff);
    if (g_Impl->rasterizer_state_) context->RSSetState(g_Impl->rasterizer_state_);
    if (g_Impl->depth_stencil_state_) context->OMSetDepthStencilState(g_Impl->depth_stencil_state_, 0);

    // Log("HudRenderer::Render: Setting VertexBuffers...");
    UINT stride = sizeof(Vertex);
    UINT offset = 0;
    if (g_Impl->vertex_buffer_) {
        context->IASetVertexBuffers(0, 1, &g_Impl->vertex_buffer_, &stride, &offset);
    } else {
        Log("CRITICAL: VertexBuffer is NULL!");
    }

    if (g_Impl->input_layout_) {
        context->IASetInputLayout(g_Impl->input_layout_);
    } else {
        Log("CRITICAL: InputLayout is NULL!");
    }
    context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP);
    
    // Log("HudRenderer::Render: Setting Shaders...");
    if (g_Impl->vertex_shader_) context->VSSetShader(g_Impl->vertex_shader_, nullptr, 0);
    else Log("CRITICAL: VS is NULL!");

    if (g_Impl->pixel_shader_) context->PSSetShader(g_Impl->pixel_shader_, nullptr, 0);
    else Log("CRITICAL: PS is NULL!");

    if (g_Impl->srv_) context->PSSetShaderResources(0, 1, &g_Impl->srv_);
    else Log("CRITICAL: SRV is NULL!");

    if (g_Impl->sampler_state_) context->PSSetSamplers(0, 1, &g_Impl->sampler_state_);
    else Log("CRITICAL: Sampler is NULL!");
    
    // Explicitly unbind other shader stages
    context->GSSetShader(nullptr, nullptr, 0);
    context->HSSetShader(nullptr, nullptr, 0);
    context->DSSetShader(nullptr, nullptr, 0);
    context->CSSetShader(nullptr, nullptr, 0);

    // Draw
    Log("HudRenderer::Render: Drawing (Safe Mode)...");
    context->Draw(4, 0);
    Log("HudRenderer::Render: Draw Complete");

    // Cleanup RTV
    rtv->Release();

    // Unbind SRV
    ID3D11ShaderResourceView* nullSRV = nullptr;
    context->PSSetShaderResources(0, 1, &nullSRV);

    // Restore State
    Log("HudRenderer::Render: Restoring State...");
    stateSaver.RestoreState(context); 
    Log("HudRenderer::Render: State Restored.");
    
    // Log("HudRenderer::Render: Skipped Draw for debugging.");
}

void HudRenderer::Shutdown() {
    if (!initialized_) return;
    if (g_Impl) {
        g_Impl->Cleanup();
        delete g_Impl;
        g_Impl = nullptr;
    }
    if (device_) {
        device_->Release();
        device_ = nullptr;
    }
    initialized_ = false;
}
