#include "state_saver.h"

D3D11StateSaver::D3D11StateSaver() : saved_(false), feature_level_(D3D_FEATURE_LEVEL_11_0) {
    ZeroMemory(vertex_buffers_, sizeof(vertex_buffers_));
    ZeroMemory(vertex_strides_, sizeof(vertex_strides_));
    ZeroMemory(vertex_offsets_, sizeof(vertex_offsets_));
    ZeroMemory(viewports_, sizeof(viewports_));
    ZeroMemory(scissor_rects_, sizeof(scissor_rects_));
    
    ZeroMemory(vs_constant_buffers_, sizeof(vs_constant_buffers_));
    ZeroMemory(vs_srvs_, sizeof(vs_srvs_));
    ZeroMemory(vs_samplers_, sizeof(vs_samplers_));
    
    ZeroMemory(ps_constant_buffers_, sizeof(ps_constant_buffers_));
    ZeroMemory(ps_srvs_, sizeof(ps_srvs_));
    ZeroMemory(ps_samplers_, sizeof(ps_samplers_));

    ZeroMemory(render_target_views_, sizeof(render_target_views_));
}

D3D11StateSaver::~D3D11StateSaver() {
    Release();
}

void D3D11StateSaver::Release() {
    if (input_layout_) input_layout_->Release();
    for (auto& buf : vertex_buffers_) if (buf) buf->Release();
    if (index_buffer_) index_buffer_->Release();
    
    if (rasterizer_state_) rasterizer_state_->Release();
    
    if (vertex_shader_) vertex_shader_->Release();
    for (UINT i = 0; i < vs_num_instances_; ++i) if (vs_instances_[i]) vs_instances_[i]->Release();
    for (auto& buf : vs_constant_buffers_) if (buf) buf->Release();
    for (auto& srv : vs_srvs_) if (srv) srv->Release();
    for (auto& samp : vs_samplers_) if (samp) samp->Release();

    if (pixel_shader_) pixel_shader_->Release();
    for (UINT i = 0; i < ps_num_instances_; ++i) if (ps_instances_[i]) ps_instances_[i]->Release();
    for (auto& buf : ps_constant_buffers_) if (buf) buf->Release();
    for (auto& srv : ps_srvs_) if (srv) srv->Release();
    for (auto& samp : ps_samplers_) if (samp) samp->Release();

    if (geometry_shader_) geometry_shader_->Release();
    for (UINT i = 0; i < gs_num_instances_; ++i) if (gs_instances_[i]) gs_instances_[i]->Release();
    
    if (hull_shader_) hull_shader_->Release();
    for (UINT i = 0; i < hs_num_instances_; ++i) if (hs_instances_[i]) hs_instances_[i]->Release();
    
    if (domain_shader_) domain_shader_->Release();
    for (UINT i = 0; i < ds_num_instances_; ++i) if (ds_instances_[i]) ds_instances_[i]->Release();
    
    if (compute_shader_) compute_shader_->Release();
    for (UINT i = 0; i < cs_num_instances_; ++i) if (cs_instances_[i]) cs_instances_[i]->Release();

    if (blend_state_) blend_state_->Release();
    if (depth_stencil_state_) depth_stencil_state_->Release();

    for (auto& rtv : render_target_views_) if (rtv) rtv->Release();
    if (depth_stencil_view_) depth_stencil_view_->Release();
    
    // Reset to null
    input_layout_ = nullptr;
    ZeroMemory(vertex_buffers_, sizeof(vertex_buffers_));
    index_buffer_ = nullptr;
    rasterizer_state_ = nullptr;
    
    vertex_shader_ = nullptr;
    vs_num_instances_ = 0;
    ZeroMemory(vs_instances_, sizeof(vs_instances_));
    ZeroMemory(vs_constant_buffers_, sizeof(vs_constant_buffers_));
    ZeroMemory(vs_srvs_, sizeof(vs_srvs_));
    ZeroMemory(vs_samplers_, sizeof(vs_samplers_));
    
    pixel_shader_ = nullptr;
    ps_num_instances_ = 0;
    ZeroMemory(ps_instances_, sizeof(ps_instances_));
    ZeroMemory(ps_constant_buffers_, sizeof(ps_constant_buffers_));
    ZeroMemory(ps_srvs_, sizeof(ps_srvs_));
    ZeroMemory(ps_samplers_, sizeof(ps_samplers_));
    
    geometry_shader_ = nullptr;
    gs_num_instances_ = 0;
    ZeroMemory(gs_instances_, sizeof(gs_instances_));

    hull_shader_ = nullptr;
    hs_num_instances_ = 0;
    ZeroMemory(hs_instances_, sizeof(hs_instances_));

    domain_shader_ = nullptr;
    ds_num_instances_ = 0;
    ZeroMemory(ds_instances_, sizeof(ds_instances_));

    compute_shader_ = nullptr;
    cs_num_instances_ = 0;
    ZeroMemory(cs_instances_, sizeof(cs_instances_));

    blend_state_ = nullptr;
    depth_stencil_state_ = nullptr;
    ZeroMemory(render_target_views_, sizeof(render_target_views_));
    depth_stencil_view_ = nullptr;
    
    saved_ = false;
}

void D3D11StateSaver::SaveCurrentState(ID3D11DeviceContext* context) {
    if (saved_) Release();

    // IA
    context->IAGetInputLayout(&input_layout_);
    context->IAGetPrimitiveTopology(&topology_);
    context->IAGetVertexBuffers(0, D3D11_IA_VERTEX_INPUT_RESOURCE_SLOT_COUNT, vertex_buffers_, vertex_strides_, vertex_offsets_);
    context->IAGetIndexBuffer(&index_buffer_, &index_format_, &index_offset_);

    // RS
    context->RSGetState(&rasterizer_state_);
    num_viewports_ = D3D11_VIEWPORT_AND_SCISSORRECT_OBJECT_COUNT_PER_PIPELINE;
    context->RSGetViewports(&num_viewports_, viewports_);
    num_scissors_ = D3D11_VIEWPORT_AND_SCISSORRECT_OBJECT_COUNT_PER_PIPELINE;
    context->RSGetScissorRects(&num_scissors_, scissor_rects_);

    // VS
    vs_num_instances_ = 256;
    context->VSGetShader(&vertex_shader_, vs_instances_, &vs_num_instances_); 
    context->VSGetConstantBuffers(0, D3D11_COMMONSHADER_CONSTANT_BUFFER_API_SLOT_COUNT, vs_constant_buffers_);
    context->VSGetShaderResources(0, D3D11_COMMONSHADER_INPUT_RESOURCE_SLOT_COUNT, vs_srvs_);
    context->VSGetSamplers(0, D3D11_COMMONSHADER_SAMPLER_SLOT_COUNT, vs_samplers_);

    // PS
    ps_num_instances_ = 256;
    context->PSGetShader(&pixel_shader_, ps_instances_, &ps_num_instances_);
    context->PSGetConstantBuffers(0, D3D11_COMMONSHADER_CONSTANT_BUFFER_API_SLOT_COUNT, ps_constant_buffers_);
    context->PSGetShaderResources(0, D3D11_COMMONSHADER_INPUT_RESOURCE_SLOT_COUNT, ps_srvs_);
    context->PSGetSamplers(0, D3D11_COMMONSHADER_SAMPLER_SLOT_COUNT, ps_samplers_);

    // GS
    gs_num_instances_ = 256;
    context->GSGetShader(&geometry_shader_, gs_instances_, &gs_num_instances_);
    // HS
    hs_num_instances_ = 256;
    context->HSGetShader(&hull_shader_, hs_instances_, &hs_num_instances_);
    // DS
    ds_num_instances_ = 256;
    context->DSGetShader(&domain_shader_, ds_instances_, &ds_num_instances_);
    // CS
    cs_num_instances_ = 256;
    context->CSGetShader(&compute_shader_, cs_instances_, &cs_num_instances_);

    // OM
    context->OMGetBlendState(&blend_state_, blend_factor_, &sample_mask_);
    context->OMGetDepthStencilState(&depth_stencil_state_, &stencil_ref_);
    context->OMGetRenderTargets(D3D11_SIMULTANEOUS_RENDER_TARGET_COUNT, render_target_views_, &depth_stencil_view_);

    saved_ = true;
}

void D3D11StateSaver::RestoreState(ID3D11DeviceContext* context) {
    if (!saved_) return;

    // IA
    context->IASetInputLayout(input_layout_);
    context->IASetPrimitiveTopology(topology_);
    context->IASetVertexBuffers(0, D3D11_IA_VERTEX_INPUT_RESOURCE_SLOT_COUNT, vertex_buffers_, vertex_strides_, vertex_offsets_);
    context->IASetIndexBuffer(index_buffer_, index_format_, index_offset_);

    // RS
    context->RSSetState(rasterizer_state_);
    context->RSSetViewports(num_viewports_, viewports_);
    context->RSSetScissorRects(num_scissors_, scissor_rects_);

    // VS
    context->VSSetShader(vertex_shader_, vs_instances_, vs_num_instances_);
    context->VSSetConstantBuffers(0, D3D11_COMMONSHADER_CONSTANT_BUFFER_API_SLOT_COUNT, vs_constant_buffers_);
    context->VSSetShaderResources(0, D3D11_COMMONSHADER_INPUT_RESOURCE_SLOT_COUNT, vs_srvs_);
    context->VSSetSamplers(0, D3D11_COMMONSHADER_SAMPLER_SLOT_COUNT, vs_samplers_);

    // PS
    context->PSSetShader(pixel_shader_, ps_instances_, ps_num_instances_);
    context->PSSetConstantBuffers(0, D3D11_COMMONSHADER_CONSTANT_BUFFER_API_SLOT_COUNT, ps_constant_buffers_);
    context->PSSetShaderResources(0, D3D11_COMMONSHADER_INPUT_RESOURCE_SLOT_COUNT, ps_srvs_);
    context->PSSetSamplers(0, D3D11_COMMONSHADER_SAMPLER_SLOT_COUNT, ps_samplers_);

    // GS
    context->GSSetShader(geometry_shader_, gs_instances_, gs_num_instances_);
    // HS
    context->HSSetShader(hull_shader_, hs_instances_, hs_num_instances_);
    // DS
    context->DSSetShader(domain_shader_, ds_instances_, ds_num_instances_);
    // CS
    context->CSSetShader(compute_shader_, cs_instances_, cs_num_instances_);

    // OM
    context->OMSetBlendState(blend_state_, blend_factor_, sample_mask_);
    context->OMSetDepthStencilState(depth_stencil_state_, stencil_ref_);
    context->OMSetRenderTargets(D3D11_SIMULTANEOUS_RENDER_TARGET_COUNT, render_target_views_, depth_stencil_view_);

    Release();
}
