#pragma once
#include <d3d11.h>
#include <vector>

class D3D11StateSaver {
public:
    D3D11StateSaver();
    ~D3D11StateSaver();

    void SaveCurrentState(ID3D11DeviceContext* context);
    void RestoreState(ID3D11DeviceContext* context);
    void Release();

private:
    bool saved_ = false;
    D3D_FEATURE_LEVEL feature_level_;

    // Input Assembler
    ID3D11InputLayout* input_layout_ = nullptr;
    D3D11_PRIMITIVE_TOPOLOGY topology_ = D3D11_PRIMITIVE_TOPOLOGY_UNDEFINED;
    ID3D11Buffer* vertex_buffers_[D3D11_IA_VERTEX_INPUT_RESOURCE_SLOT_COUNT] = { nullptr };
    UINT vertex_strides_[D3D11_IA_VERTEX_INPUT_RESOURCE_SLOT_COUNT] = { 0 };
    UINT vertex_offsets_[D3D11_IA_VERTEX_INPUT_RESOURCE_SLOT_COUNT] = { 0 };
    ID3D11Buffer* index_buffer_ = nullptr;
    DXGI_FORMAT index_format_ = DXGI_FORMAT_UNKNOWN;
    UINT index_offset_ = 0;

    // Rasterizer
    ID3D11RasterizerState* rasterizer_state_ = nullptr;
    UINT num_viewports_ = D3D11_VIEWPORT_AND_SCISSORRECT_OBJECT_COUNT_PER_PIPELINE;
    D3D11_VIEWPORT viewports_[D3D11_VIEWPORT_AND_SCISSORRECT_OBJECT_COUNT_PER_PIPELINE];

    // Vendor Shader (VS)
    ID3D11VertexShader* vertex_shader_ = nullptr;
    UINT vs_num_instances_ = 0;
    ID3D11ClassInstance* vs_instances_[256] = { nullptr };
    ID3D11Buffer* vs_constant_buffers_[D3D11_COMMONSHADER_CONSTANT_BUFFER_API_SLOT_COUNT] = { nullptr };
    ID3D11ShaderResourceView* vs_srvs_[D3D11_COMMONSHADER_INPUT_RESOURCE_SLOT_COUNT] = { nullptr };
    ID3D11SamplerState* vs_samplers_[D3D11_COMMONSHADER_SAMPLER_SLOT_COUNT] = { nullptr };

    // Pixel Shader (PS)
    ID3D11PixelShader* pixel_shader_ = nullptr;
    UINT ps_num_instances_ = 0;
    ID3D11ClassInstance* ps_instances_[256] = { nullptr };
    ID3D11Buffer* ps_constant_buffers_[D3D11_COMMONSHADER_CONSTANT_BUFFER_API_SLOT_COUNT] = { nullptr };
    ID3D11ShaderResourceView* ps_srvs_[D3D11_COMMONSHADER_INPUT_RESOURCE_SLOT_COUNT] = { nullptr };
    ID3D11SamplerState* ps_samplers_[D3D11_COMMONSHADER_SAMPLER_SLOT_COUNT] = { nullptr };
    
    // Output Merger (OM)
    ID3D11BlendState* blend_state_ = nullptr;
    float blend_factor_[4] = { 0.f };
    UINT sample_mask_ = 0xffffffff;
    ID3D11DepthStencilState* depth_stencil_state_ = nullptr;
    UINT stencil_ref_ = 0;
    ID3D11RenderTargetView* render_target_views_[D3D11_SIMULTANEOUS_RENDER_TARGET_COUNT] = { nullptr };
    ID3D11DepthStencilView* depth_stencil_view_ = nullptr;

    // Rasterizer (Scissor)
    UINT num_scissors_ = D3D11_VIEWPORT_AND_SCISSORRECT_OBJECT_COUNT_PER_PIPELINE;
    D3D11_RECT scissor_rects_[D3D11_VIEWPORT_AND_SCISSORRECT_OBJECT_COUNT_PER_PIPELINE];

    // Geometry Shader (GS)
    ID3D11GeometryShader* geometry_shader_ = nullptr;
    ID3D11ClassInstance* gs_instances_[256] = { nullptr };
    UINT gs_num_instances_ = 0;

    // Hull Shader (HS)
    ID3D11HullShader* hull_shader_ = nullptr;
    ID3D11ClassInstance* hs_instances_[256] = { nullptr };
    UINT hs_num_instances_ = 0;

    // Domain Shader (DS)
    ID3D11DomainShader* domain_shader_ = nullptr;
    ID3D11ClassInstance* ds_instances_[256] = { nullptr };
    UINT ds_num_instances_ = 0;

    // Compute Shader (CS)
    ID3D11ComputeShader* compute_shader_ = nullptr;
    ID3D11ClassInstance* cs_instances_[256] = { nullptr };
    UINT cs_num_instances_ = 0;
};
