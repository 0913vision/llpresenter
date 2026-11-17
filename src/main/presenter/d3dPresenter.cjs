const {Buffer} = require('node:buffer');
const {performance} = require('node:perf_hooks');
const k = require('koffi');

// NOTE(0913vision): Chromium paces every window by the primary display's
// vblank on Windows, so an output on a monitor with another refresh rate
// shows its frames unevenly. This window presents through its own flip swap
// chain, which DXGI paces by the vblank of the monitor it is on, the way
// PowerPoint's slide show does. Slide transitions are blended here, one step
// per vblank, between the picture that was shown and the live page.

const user32 = k.load('user32.dll');
const kernel32 = k.load('kernel32.dll');
const d3d11 = k.load('d3d11.dll');
const compiler = k.load('d3dcompiler_47.dll');
const outPtr = k.out(k.pointer('void *'));
const pointerArray = k.pointer('void *');

const GetModuleHandleW = kernel32.func('GetModuleHandleW', 'void *', ['str16']);
const GetProcAddress = kernel32.func('GetProcAddress', 'void *', [
  'void *',
  'str',
]);
const OpenProcess = kernel32.func('OpenProcess', 'void *', [
  'uint32',
  'int',
  'uint32',
]);
const GetCurrentProcess = kernel32.func('GetCurrentProcess', 'void *', []);
const DuplicateHandle = kernel32.func('DuplicateHandle', 'int', [
  'void *',
  'void *',
  'void *',
  outPtr,
  'uint32',
  'int',
  'uint32',
]);
const CloseHandle = kernel32.func('CloseHandle', 'int', ['void *']);
const GetLastError = kernel32.func('GetLastError', 'uint32', []);
const WNDCLASSEXW = k.struct('LLPPresenterClass', {
  cbSize: 'uint32',
  style: 'uint32',
  lpfnWndProc: 'void *',
  cbClsExtra: 'int',
  cbWndExtra: 'int',
  hInstance: 'void *',
  hIcon: 'void *',
  hCursor: 'void *',
  hbrBackground: 'void *',
  lpszMenuName: 'str16',
  lpszClassName: 'str16',
  hIconSm: 'void *',
});
const RegisterClassExW = user32.func('RegisterClassExW', 'uint16', [
  k.pointer(WNDCLASSEXW),
]);
const CreateWindowExW = user32.func('CreateWindowExW', 'void *', [
  'uint32',
  'str16',
  'str16',
  'uint32',
  'int',
  'int',
  'int',
  'int',
  'void *',
  'void *',
  'void *',
  'void *',
]);
const DestroyWindow = user32.func('DestroyWindow', 'int', ['void *']);
const LoadCursorW = user32.func('LoadCursorW', 'void *', ['void *', 'uintptr']);
const ShowWindow = user32.func('ShowWindow', 'int', ['void *', 'int']);
const SetWindowPos = user32.func('SetWindowPos', 'int', [
  'void *',
  'intptr',
  'int',
  'int',
  'int',
  'int',
  'uint32',
]);
const PeekMessageW = user32.func('PeekMessageW', 'int', [
  'void *',
  'void *',
  'uint32',
  'uint32',
  'uint32',
]);
const TranslateMessage = user32.func('TranslateMessage', 'int', ['void *']);
const DispatchMessageW = user32.func('DispatchMessageW', 'intptr', ['void *']);
const SwapChainDesc = k.struct('LLPPresenterSwapChainDesc', {
  Width: 'uint32',
  Height: 'uint32',
  RefreshNumerator: 'uint32',
  RefreshDenominator: 'uint32',
  Format: 'uint32',
  ScanlineOrdering: 'uint32',
  Scaling: 'uint32',
  SampleCount: 'uint32',
  SampleQuality: 'uint32',
  BufferUsage: 'uint32',
  BufferCount: 'uint32',
  OutputWindow: 'void *',
  Windowed: 'int',
  SwapEffect: 'uint32',
  Flags: 'uint32',
});
const CreateDeviceAndSwapChain = d3d11.func(
  'D3D11CreateDeviceAndSwapChain',
  'int32',
  [
    'void *',
    'uint32',
    'void *',
    'uint32',
    'void *',
    'uint32',
    'uint32',
    k.pointer(SwapChainDesc),
    outPtr,
    outPtr,
    'void *',
    outPtr,
  ],
);
const D3DCompile = compiler.func('D3DCompile', 'int32', [
  'str',
  'size_t',
  'str',
  'void *',
  'void *',
  'str',
  'str',
  'uint32',
  'uint32',
  outPtr,
  outPtr,
]);

const IDC_ARROW = 32512;
const WS_POPUP = 0x80000000;
const WS_EX_TOPMOST = 0x8;
const WS_EX_TOOLWINDOW = 0x80;
const WS_EX_NOACTIVATE = 0x08000000;
const SW_HIDE = 0;
const SW_SHOWNOACTIVATE = 4;
const HWND_TOP = 0;
const HWND_TOPMOST = -1;
const HWND_NOTOPMOST = -2;
const SWP_NOACTIVATE = 0x10;
const SWP_SHOWWINDOW = 0x40;
const PM_REMOVE = 1;
const DXGI_FORMAT_B8G8R8A8_UNORM = 87;
const DXGI_USAGE_RENDER_TARGET_OUTPUT = 0x20;
const DXGI_SWAP_EFFECT_FLIP_DISCARD = 4;
const D3D_DRIVER_TYPE_HARDWARE = 1;
const D3D11_CREATE_DEVICE_BGRA_SUPPORT = 0x20;
const D3D11_SDK_VERSION = 7;
const D3D11_BIND_SHADER_RESOURCE = 0x8;
const D3D11_BIND_RENDER_TARGET = 0x20;
const D3D11_BIND_CONSTANT_BUFFER = 0x4;
const D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST = 4;
const D3D11_QUERY_EVENT = 0;
const PROCESS_DUP_HANDLE = 0x40;
const DUPLICATE_SAME_ACCESS = 2;
const TEXTURE_DESC_SIZE = 44;
const POINTER_SIZE = 8;

// NOTE(0913vision): Slots follow the COM interface order in d3d11.h, dxgi.h
// and d3dcommon.h (IUnknown first).
const SLOT = {
  queryInterface: 0,
  release: 2,
  blobPointer: 3,
  blobSize: 4,
  deviceCreateBuffer: 3,
  deviceCreateTexture2D: 5,
  deviceCreateShaderResourceView: 7,
  deviceCreateRenderTargetView: 9,
  deviceCreateVertexShader: 12,
  deviceCreatePixelShader: 15,
  deviceCreateSamplerState: 23,
  deviceCreateQuery: 24,
  textureGetDesc: 10,
  device1OpenSharedResource1: 48,
  dxgiDeviceSetMaximumFrameLatency: 12,
  swapPresent: 8,
  swapGetBuffer: 9,
  contextPSSetShaderResources: 8,
  contextPSSetShader: 9,
  contextPSSetSamplers: 10,
  contextVSSetShader: 11,
  contextDraw: 13,
  contextPSSetConstantBuffers: 16,
  contextIASetPrimitiveTopology: 24,
  contextEnd: 28,
  contextGetData: 29,
  contextOMSetRenderTargets: 33,
  contextRSSetViewports: 44,
  contextCopyResource: 47,
  contextUpdateSubresource: 48,
};

const IID = {
  texture2D: Buffer.from('f2aa156f08d2894e9ab4489535d34f9c', 'hex'),
  device1: Buffer.from('29fb4ba0ef08d643a49ca9bdbdcbe686', 'hex'),
  dxgiDevice1: Buffer.from('0f97db777662ba48ba28070143b4392c', 'hex'),
};

const protos = new Map();
const typeNames = new Map([
  [outPtr, 'out'],
  [pointerArray, 'array'],
]);
function call(obj, slot, ret, args, ...values) {
  const key = `${slot}|${ret}|${args.map(arg => (typeof arg === 'string' ? arg : typeNames.get(arg))).join(',')}`;
  let proto = protos.get(key);
  if (proto === undefined) {
    proto = k.proto(`LLPPresenter${protos.size}`, ret, ['void *', ...args]);
    protos.set(key, proto);
  }
  const table = k.decode(obj, 'void *');
  const fn = k.decode(table, slot * POINTER_SIZE, 'void *');
  return k.call(fn, proto, obj, ...values);
}
/** Resolves one COM method once, for calls made every frame. */
function bind(obj, slot, ret, args) {
  const proto = k.proto(`LLPPresenterBound${protos.size}_${slot}`, ret, [
    'void *',
    ...args,
  ]);
  protos.set(`bound|${protos.size}`, proto);
  const table = k.decode(obj, 'void *');
  const fn = k.decode(table, slot * POINTER_SIZE, 'void *');
  return (...values) => k.call(fn, proto, obj, ...values);
}
function release(obj) {
  if (obj) call(obj, SLOT.release, 'uint32', []);
}
function check(hr, what) {
  if (hr < 0) throw Error(`${what} HRESULT 0x${(hr >>> 0).toString(16)}`);
}

const SHADER = [
  'Texture2D<float4> liveTexture : register(t0);',
  'Texture2D<float4> shownTexture : register(t1);',
  'SamplerState linearClamp : register(s0);',
  'cbuffer Blend : register(b0) { float mode; float progress; float dir; float width; float height; float3 pad; };',
  'struct V { float4 pos : SV_Position; };',
  'V vs(uint id : SV_VertexID) { V o; float2 uv = float2((id << 1) & 2, id & 2);',
  '  o.pos = float4(uv * float2(2, -2) + float2(-1, 1), 0, 1); return o; }',
  // NOTE(0913vision): Pictures are sampled by position on the screen, so a page drawn at another size still fills the monitor.
  'float4 at(Texture2D<float4> t, float2 uv) {',
  '  if (any(uv < 0) || any(uv >= 1)) return float4(0, 0, 0, 1);',
  '  return t.SampleLevel(linearClamp, uv, 0); }',
  'float4 ps(V i) : SV_Target {',
  '  float2 size = float2(width, height);',
  '  float2 uv = i.pos.xy / size;',
  '  float4 next = at(liveTexture, uv);',
  '  if (mode < 0.5) return next;',
  '  float4 shown = at(shownTexture, uv);',
  '  if (mode < 1.5) {',
  // NOTE(0913vision): Wipe dir 0 is left (new from the right), 1 right, 2 up (new from the bottom), 3 down.
  '    float s = dir < 0.5 ? uv.x : dir < 1.5 ? 1 - uv.x : dir < 2.5 ? uv.y : 1 - uv.y;',
  '    float t = saturate((s - (0.915 - 2.02 * progress)) / 0.97);',
  '    return lerp(shown, next, t * t * (3 - 2 * t)); }',
  '  if (mode < 2.5) return lerp(shown, next, progress);',
  // NOTE(0913vision): Push moves the shown picture out and the new one in behind it.
  '  float2 axis = dir < 0.5 ? float2(1, 0) : dir < 1.5 ? float2(-1, 0) : dir < 2.5 ? float2(0, 1) : float2(0, -1);',
  '  float2 moved = uv + axis * progress;',
  '  return all(moved >= 0) && all(moved < 1) ? at(shownTexture, moved) : at(liveTexture, uv - axis * (1 - progress)); }',
].join('\n');

const MODES = {cut: 0, wipe: 1, dissolve: 2, push: 3};
const DIRECTIONS = {left: 0, right: 1, up: 2, down: 3};

let classRegistered = false;

/**
 * Creates the presenter for one output monitor. `bounds` are in physical
 * pixels; `hz` is the monitor's refresh rate.
 */
function createPresenter({x, y, width, height, hz, topmost}) {
  const instance = GetModuleHandleW(null);
  if (!classRegistered) {
    RegisterClassExW({
      cbSize: 80,
      style: 0,
      lpfnWndProc: GetProcAddress(
        GetModuleHandleW('user32.dll'),
        'DefWindowProcW',
      ),
      cbClsExtra: 0,
      cbWndExtra: 0,
      hInstance: instance,
      hIcon: null,
      hCursor: LoadCursorW(null, IDC_ARROW),
      hbrBackground: null,
      lpszMenuName: null,
      lpszClassName: 'LoveLightOutput',
      hIconSm: null,
    });
    classRegistered = true;
  }
  const hwnd = CreateWindowExW(
    WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | (topmost ? WS_EX_TOPMOST : 0),
    'LoveLightOutput',
    'LoveLight output',
    WS_POPUP,
    x,
    y,
    width,
    height,
    null,
    null,
    instance,
    null,
  );
  if (!hwnd) throw Error(`CreateWindowExW ${GetLastError()}`);
  const swapChain = [null];
  const device = [null];
  const context = [null];
  check(
    CreateDeviceAndSwapChain(
      null,
      D3D_DRIVER_TYPE_HARDWARE,
      null,
      D3D11_CREATE_DEVICE_BGRA_SUPPORT,
      null,
      0,
      D3D11_SDK_VERSION,
      {
        Width: width,
        Height: height,
        RefreshNumerator: 0,
        RefreshDenominator: 0,
        Format: DXGI_FORMAT_B8G8R8A8_UNORM,
        ScanlineOrdering: 0,
        Scaling: 0,
        SampleCount: 1,
        SampleQuality: 0,
        BufferUsage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
        BufferCount: 3,
        OutputWindow: hwnd,
        Windowed: 1,
        SwapEffect: DXGI_SWAP_EFFECT_FLIP_DISCARD,
        Flags: 0,
      },
      swapChain,
      device,
      null,
      context,
    ),
    'D3D11CreateDeviceAndSwapChain',
  );
  const device1 = [null];
  check(
    call(
      device[0],
      SLOT.queryInterface,
      'int32',
      ['void *', outPtr],
      IID.device1,
      device1,
    ),
    'QueryInterface device1',
  );
  const dxgiDevice = [null];
  if (
    call(
      device[0],
      SLOT.queryInterface,
      'int32',
      ['void *', outPtr],
      IID.dxgiDevice1,
      dxgiDevice,
    ) >= 0
  ) {
    call(
      dxgiDevice[0],
      SLOT.dxgiDeviceSetMaximumFrameLatency,
      'int32',
      ['uint32'],
      2,
    );
    release(dxgiDevice[0]);
  }

  const created = [];
  const keep = obj => {
    created.push(obj);
    return obj;
  };
  const backBuffer = [null];
  check(
    call(
      swapChain[0],
      SLOT.swapGetBuffer,
      'int32',
      ['uint32', 'void *', outPtr],
      0,
      IID.texture2D,
      backBuffer,
    ),
    'GetBuffer',
  );
  keep(backBuffer[0]);
  const backTarget = [null];
  check(
    call(
      device[0],
      SLOT.deviceCreateRenderTargetView,
      'int32',
      ['void *', 'void *', outPtr],
      backBuffer[0],
      null,
      backTarget,
    ),
    'CreateRenderTargetView',
  );
  keep(backTarget[0]);

  function compile(entry, target) {
    const code = [null];
    const errors = [null];
    const hr = D3DCompile(
      SHADER,
      Buffer.byteLength(SHADER),
      'presenter',
      null,
      null,
      entry,
      target,
      0,
      0,
      code,
      errors,
    );
    if (hr < 0) {
      const text = errors[0]
        ? k.decode(call(errors[0], SLOT.blobPointer, 'void *', []), 'str')
        : '';
      release(errors[0]);
      throw Error(`D3DCompile ${entry}: ${text}`);
    }
    return keep(code[0]);
  }
  const vsBlob = compile('vs', 'vs_5_0');
  const psBlob = compile('ps', 'ps_5_0');
  const blobPtr = blob => call(blob, SLOT.blobPointer, 'void *', []);
  const blobSize = blob => call(blob, SLOT.blobSize, 'size_t', []);
  const vertexShader = [null];
  check(
    call(
      device[0],
      SLOT.deviceCreateVertexShader,
      'int32',
      ['void *', 'size_t', 'void *', outPtr],
      blobPtr(vsBlob),
      blobSize(vsBlob),
      null,
      vertexShader,
    ),
    'CreateVertexShader',
  );
  keep(vertexShader[0]);
  const pixelShader = [null];
  check(
    call(
      device[0],
      SLOT.deviceCreatePixelShader,
      'int32',
      ['void *', 'size_t', 'void *', outPtr],
      blobPtr(psBlob),
      blobSize(psBlob),
      null,
      pixelShader,
    ),
    'CreatePixelShader',
  );
  keep(pixelShader[0]);
  const bufferDesc = Buffer.alloc(24);
  bufferDesc.writeUInt32LE(32, 0);
  bufferDesc.writeUInt32LE(D3D11_BIND_CONSTANT_BUFFER, 8);
  const constants = [null];
  check(
    call(
      device[0],
      SLOT.deviceCreateBuffer,
      'int32',
      ['void *', 'void *', outPtr],
      bufferDesc,
      null,
      constants,
    ),
    'CreateBuffer',
  );
  keep(constants[0]);
  const samplerDesc = Buffer.alloc(52);
  samplerDesc.writeUInt32LE(0x15, 0);
  samplerDesc.writeUInt32LE(3, 4);
  samplerDesc.writeUInt32LE(3, 8);
  samplerDesc.writeUInt32LE(3, 12);
  samplerDesc.writeUInt32LE(1, 20);
  samplerDesc.writeUInt32LE(1, 24);
  samplerDesc.writeFloatLE(3.402823466e38, 48);
  const sampler = [null];
  check(
    call(
      device[0],
      SLOT.deviceCreateSamplerState,
      'int32',
      ['void *', outPtr],
      samplerDesc,
      sampler,
    ),
    'CreateSamplerState',
  );
  keep(sampler[0]);
  const queryDesc = Buffer.alloc(8);
  queryDesc.writeUInt32LE(D3D11_QUERY_EVENT, 0);
  const query = [null];
  check(
    call(
      device[0],
      SLOT.deviceCreateQuery,
      'int32',
      ['void *', outPtr],
      queryDesc,
      query,
    ),
    'CreateQuery',
  );
  keep(query[0]);

  function texture(format, bind, w = width, h = height) {
    const desc = Buffer.alloc(TEXTURE_DESC_SIZE);
    [w, h, 1, 1, format, 1, 0, 0, bind, 0, 0].forEach((value, index) =>
      desc.writeUInt32LE(value, index * 4),
    );
    const out = [null];
    check(
      call(
        device[0],
        SLOT.deviceCreateTexture2D,
        'int32',
        ['void *', 'void *', outPtr],
        desc,
        null,
        out,
      ),
      'CreateTexture2D',
    );
    const view = [null];
    check(
      call(
        device[0],
        SLOT.deviceCreateShaderResourceView,
        'int32',
        ['void *', 'void *', outPtr],
        out[0],
        null,
        view,
      ),
      'CreateShaderResourceView',
    );
    let target = null;
    if (bind & D3D11_BIND_RENDER_TARGET) {
      const rtv = [null];
      check(
        call(
          device[0],
          SLOT.deviceCreateRenderTargetView,
          'int32',
          ['void *', 'void *', outPtr],
          out[0],
          null,
          rtv,
        ),
        'CreateRenderTargetView',
      );
      target = rtv[0];
    }
    return {
      texture: out[0],
      view: view[0],
      target,
      format,
      width: w,
      height: h,
    };
  }
  const releaseTexture = t => {
    if (!t) return;
    release(t.target);
    release(t.view);
    release(t.texture);
  };
  let live = null;
  // NOTE(0913vision): Two pictures of what was shown, so a transition that
  // starts during another one can draw the current blend from one into the other.
  let held = texture(
    DXGI_FORMAT_B8G8R8A8_UNORM,
    D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_RENDER_TARGET,
  );
  let spare = texture(
    DXGI_FORMAT_B8G8R8A8_UNORM,
    D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_RENDER_TARGET,
  );
  const black = texture(DXGI_FORMAT_B8G8R8A8_UNORM, D3D11_BIND_SHADER_RESOURCE);

  const viewport = Buffer.alloc(24);
  viewport.writeFloatLE(width, 8);
  viewport.writeFloatLE(height, 12);
  viewport.writeFloatLE(1, 20);
  const params = Buffer.alloc(32);
  const message = Buffer.alloc(48);
  const refresh = hz > 0 ? hz : 60;
  let blend = {mode: MODES.cut, dir: 0, frames: 0, step: 0};
  let visible = false;
  let hasFrame = false;
  let closed = false;
  let lastPresent = 0;
  const intervals = [];

  const ctx = context[0];
  const frameCalls = {
    update: bind(ctx, SLOT.contextUpdateSubresource, 'void', [
      'void *',
      'uint32',
      'void *',
      'void *',
      'uint32',
      'uint32',
    ]),
    targets: bind(ctx, SLOT.contextOMSetRenderTargets, 'void', [
      'uint32',
      pointerArray,
      'void *',
    ]),
    viewports: bind(ctx, SLOT.contextRSSetViewports, 'void', [
      'uint32',
      'void *',
    ]),
    topology: bind(ctx, SLOT.contextIASetPrimitiveTopology, 'void', ['uint32']),
    vertexShader: bind(ctx, SLOT.contextVSSetShader, 'void', [
      'void *',
      'void *',
      'uint32',
    ]),
    pixelShader: bind(ctx, SLOT.contextPSSetShader, 'void', [
      'void *',
      'void *',
      'uint32',
    ]),
    constants: bind(ctx, SLOT.contextPSSetConstantBuffers, 'void', [
      'uint32',
      'uint32',
      pointerArray,
    ]),
    samplers: bind(ctx, SLOT.contextPSSetSamplers, 'void', [
      'uint32',
      'uint32',
      pointerArray,
    ]),
    resources: bind(ctx, SLOT.contextPSSetShaderResources, 'void', [
      'uint32',
      'uint32',
      pointerArray,
    ]),
    draw: bind(ctx, SLOT.contextDraw, 'void', ['uint32', 'uint32']),
    copy: bind(ctx, SLOT.contextCopyResource, 'void', ['void *', 'void *']),
    end: bind(ctx, SLOT.contextEnd, 'void', ['void *']),
    getData: bind(ctx, SLOT.contextGetData, 'int32', [
      'void *',
      'void *',
      'uint32',
      'uint32',
    ]),
    present: bind(swapChain[0], SLOT.swapPresent, 'int32', [
      'uint32',
      'uint32',
    ]),
    open: bind(device1[0], SLOT.device1OpenSharedResource1, 'int32', [
      'void *',
      'void *',
      outPtr,
    ]),
  };
  const constantList = [constants[0]];
  const samplerList = [sampler[0]];
  const noResources = [null, null];
  const doneFlag = Buffer.alloc(4);

  function draw(target, state) {
    const progress =
      state.frames > 0 ? Math.min(1, state.step / state.frames) : 1;
    params.writeFloatLE(progress >= 1 ? MODES.cut : state.mode, 0);
    params.writeFloatLE(progress, 4);
    params.writeFloatLE(state.dir, 8);
    params.writeFloatLE(width, 12);
    params.writeFloatLE(height, 16);
    frameCalls.update(constants[0], 0, null, params, 0, 0);
    frameCalls.targets(1, [target], null);
    frameCalls.viewports(1, viewport);
    frameCalls.topology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    frameCalls.vertexShader(vertexShader[0], null, 0);
    frameCalls.pixelShader(pixelShader[0], null, 0);
    frameCalls.constants(0, 1, constantList);
    frameCalls.samplers(0, 1, samplerList);
    frameCalls.resources(0, 2, [(live ?? black).view, held.view]);
    frameCalls.draw(3, 0);
    // NOTE(0913vision): Unbind the inputs so a held picture can be a target next time.
    frameCalls.resources(0, 2, noResources);
  }

  // NOTE(0913vision): A page frame stays open until the GPU has copied it;
  // the copy is checked once per frame, so the loop never waits for it.
  let copying = null;
  function copyDone() {
    if (copying === null) return false;
    const state = frameCalls.getData(query[0], doneFlag, 4, 0);
    if (state !== 0) return false;
    release(copying.shared);
    CloseHandle(copying.handle);
    CloseHandle(copying.proc);
    copying = null;
    return true;
  }

  return {
    hwnd,
    /** Copies one shared texture of the page from process `pid` into the live picture. */
    submit(pid, rawHandle) {
      if (copying !== null) throw Error('a page frame is still being copied');
      const proc = OpenProcess(PROCESS_DUP_HANDLE, 0, pid);
      if (!proc) throw Error(`OpenProcess ${GetLastError()}`);
      const handle = [null];
      let shared = null;
      try {
        if (
          !DuplicateHandle(
            proc,
            BigInt(`0x${rawHandle}`),
            GetCurrentProcess(),
            handle,
            0,
            0,
            DUPLICATE_SAME_ACCESS,
          )
        ) {
          throw Error(`DuplicateHandle ${GetLastError()}`);
        }
        const out = [null];
        check(
          frameCalls.open(handle[0], IID.texture2D, out),
          'OpenSharedResource1',
        );
        shared = out[0];
        const desc = Buffer.alloc(TEXTURE_DESC_SIZE);
        call(shared, SLOT.textureGetDesc, 'void', ['void *'], desc);
        const w = desc.readUInt32LE(0);
        const h = desc.readUInt32LE(4);
        const format = desc.readUInt32LE(16);
        if (
          live === null ||
          live.format !== format ||
          live.width !== w ||
          live.height !== h
        ) {
          releaseTexture(live);
          live = texture(format, D3D11_BIND_SHADER_RESOURCE, w, h);
        }
        frameCalls.copy(live.texture, shared);
        frameCalls.end(query[0]);
        copying = {shared, handle: handle[0], proc};
        hasFrame = true;
      } catch (error) {
        release(shared);
        if (handle[0]) CloseHandle(handle[0]);
        CloseHandle(proc);
        throw error;
      }
    },
    /** Whether the last submitted page frame has been copied and released. */
    copied() {
      return copyDone();
    },
    /** Starts a transition from what is shown now to the live picture. */
    transition({kind, dir, sec}) {
      draw(spare.target, blend);
      [held, spare] = [spare, held];
      const mode = MODES[kind] ?? MODES.cut;
      blend = {
        mode,
        dir: DIRECTIONS[dir] ?? 0,
        frames: mode === MODES.cut ? 0 : Math.max(1, Math.round(sec * refresh)),
        step: 0,
      };
    },
    /** Draws and presents one frame; blocks until the monitor takes it. */
    frame() {
      while (PeekMessageW(message, null, 0, 0, PM_REMOVE)) {
        TranslateMessage(message);
        DispatchMessageW(message);
      }
      if (!visible || closed) return false;
      const moving = blend.frames > 0 && blend.step < blend.frames;
      if (moving) blend.step++;
      draw(backTarget[0], blend);
      check(frameCalls.present(1, 0), 'Present');
      const now = performance.now();
      if (moving && lastPresent !== 0) intervals.push(now - lastPresent);
      lastPresent = now;
      return true;
    },
    show(onTop) {
      if (!hasFrame) return false;
      SetWindowPos(
        hwnd,
        onTop ? HWND_TOPMOST : HWND_NOTOPMOST,
        x,
        y,
        width,
        height,
        SWP_NOACTIVATE | SWP_SHOWWINDOW,
      );
      ShowWindow(hwnd, SW_SHOWNOACTIVATE);
      visible = true;
      return true;
    },
    setOnTop(onTop) {
      SetWindowPos(
        hwnd,
        onTop ? HWND_TOPMOST : HWND_TOP,
        0,
        0,
        0,
        0,
        SWP_NOACTIVATE | 0x1 | 0x2,
      );
    },
    hide() {
      ShowWindow(hwnd, SW_HIDE);
      visible = false;
    },
    get visible() {
      return visible;
    },
    /** Present intervals (ms) measured during transitions since the last call. */
    takeIntervals() {
      return intervals.splice(0);
    },
    get busy() {
      return blend.frames > 0 && blend.step < blend.frames;
    },
    close() {
      if (closed) return;
      closed = true;
      if (copying !== null) {
        release(copying.shared);
        CloseHandle(copying.handle);
        CloseHandle(copying.proc);
        copying = null;
      }
      releaseTexture(live);
      releaseTexture(held);
      releaseTexture(spare);
      releaseTexture(black);
      for (const obj of created.reverse()) release(obj);
      release(device1[0]);
      release(swapChain[0]);
      release(context[0]);
      release(device[0]);
      DestroyWindow(hwnd);
    },
  };
}

module.exports = {createPresenter};
