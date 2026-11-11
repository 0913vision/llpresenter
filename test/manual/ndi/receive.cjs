// NOTE(0913vision): Standalone receiver runs outside the app in its own process.
const process = require('node:process');
const console = require('node:console');
const {Buffer} = require('node:buffer');
const {writeFileSync} = require('node:fs');
const koffi = require('koffi');
const {runtimePath} = require('../../../src/main/ndi/ndi-library.cjs');

const dll = runtimePath();
if (!dll || !process.argv[2]) {
  throw new Error('runtime and output path required');
}
const lib = koffi.load(dll);
const source = koffi.struct({
  p_ndi_name: 'const char *',
  p_url_address: 'const char *',
});
const findSettings = koffi.struct({
  show_local_sources: 'bool',
  p_groups: 'const char *',
  p_extra_ips: 'const char *',
});
const recvSettings = koffi.struct({
  source_to_connect_to: source,
  color_format: 'int',
  bandwidth: 'int',
  allow_video_fields: 'bool',
  p_ndi_recv_name: 'const char *',
});
const video = koffi.struct({
  xres: 'int',
  yres: 'int',
  FourCC: 'uint32_t',
  frame_rate_N: 'int',
  frame_rate_D: 'int',
  picture_aspect_ratio: 'float',
  frame_format_type: 'int',
  timecode: 'int64_t',
  p_data: 'void *',
  line_stride_in_bytes: 'int',
  p_metadata: 'const char *',
  timestamp: 'int64_t',
});
const perf = koffi.struct({
  video_frames: 'int64_t',
  audio_frames: 'int64_t',
  metadata_frames: 'int64_t',
});
const init = lib.func('NDIlib_initialize', 'bool', []);
const destroy = lib.func('NDIlib_destroy', 'void', []);
const findCreate = lib.func('NDIlib_find_create_v2', 'void *', [
  koffi.pointer(findSettings),
]);
const findWait = lib.func('NDIlib_find_wait_for_sources', 'bool', [
  'void *',
  'uint32_t',
]);
const findSources = lib.func('NDIlib_find_get_current_sources', 'void *', [
  'void *',
  koffi.out(koffi.pointer('uint32_t')),
]);
const findDestroy = lib.func('NDIlib_find_destroy', 'void', ['void *']);
const recvCreate = lib.func('NDIlib_recv_create_v3', 'void *', [
  koffi.pointer(recvSettings),
]);
const recvCapture = lib.func('NDIlib_recv_capture_v2', 'int', [
  'void *',
  koffi.out(koffi.pointer(video)),
  'void *',
  'void *',
  'uint32_t',
]);
const recvFree = lib.func('NDIlib_recv_free_video_v2', 'void', [
  'void *',
  koffi.pointer(video),
]);
const recvDestroy = lib.func('NDIlib_recv_destroy', 'void', ['void *']);
const recvPerformance = lib.func('NDIlib_recv_get_performance', 'void', [
  'void *',
  koffi.out(koffi.pointer(perf)),
  koffi.out(koffi.pointer(perf)),
]);
function saveFrame(frame) {
  console.log(
    'Video:',
    frame.xres,
    frame.yres,
    frame.FourCC.toString(16),
    'stride',
    frame.line_stride_in_bytes,
  );
  if (
    frame.FourCC !== 0x41524742 ||
    frame.xres !== 1920 ||
    frame.yres !== 1080
  ) {
    return false;
  }
  const pixels = Buffer.from(
    koffi.view(frame.p_data, frame.line_stride_in_bytes * frame.yres),
  );
  const out = Buffer.alloc(frame.xres * frame.yres * 4);
  for (let y = 0; y < frame.yres; y++) {
    pixels.copy(
      out,
      y * frame.xres * 4,
      y * frame.line_stride_in_bytes,
      y * frame.line_stride_in_bytes + frame.xres * 4,
    );
  }
  let nonzero = 0;
  for (let i = 3; i < out.length; i += 4) {
    if (out[i]) nonzero++;
  }
  if (out[3] !== 0 || nonzero <= 100) return false;
  writeFileSync(process.argv[2], out);
  console.log('Saved BGRA:', process.argv[2], 'nonzero alpha pixels:', nonzero);
  return true;
}
if (!init()) throw new Error('NDI initialize failed');
const finder = findCreate({
  show_local_sources: true,
  p_groups: null,
  p_extra_ips: null,
});
let receiver = null;
try {
  let found;
  const deadline = Date.now() + 60000;
  while (!found && Date.now() < deadline) {
    const count = [0];
    const pointer = findSources(finder, count);
    const sources = count[0] ? koffi.decode(pointer, source, count[0]) : [];
    found = sources.find(item =>
      item.p_ndi_name?.includes('LOVELIGHT 방송 화면'),
    );
    if (!found) findWait(finder, 1000);
  }
  if (!found) throw new Error('NDI source not discovered');
  console.log('Found source:', found.p_ndi_name);
  receiver = recvCreate({
    source_to_connect_to: found,
    color_format: 0,
    bandwidth: 100,
    allow_video_fields: false,
    p_ndi_recv_name: 'LOVELIGHT spike receiver',
  });
  if (!receiver) throw new Error('receiver creation failed');
  let saved = false;
  let frames = 0;
  const duration = Number(process.env.LLP_NDI_RECEIVE_MS || 0);
  const receiveStart = Date.now();
  const until = duration ? receiveStart + duration : deadline;
  while ((!saved || duration > 0) && Date.now() < until) {
    const frame = {};
    const kind = recvCapture(receiver, frame, null, null, 1000);
    if (kind !== 1) continue;
    try {
      frames++;
      saved ||= saveFrame(frame);
    } finally {
      recvFree(receiver, frame);
    }
  }
  const total = {},
    dropped = {};
  recvPerformance(receiver, total, dropped);
  const stats = {
    started: receiveStart,
    ended: Date.now(),
    captured: frames,
    total,
    dropped,
  };
  if (process.env.LLP_NDI_RECEIVE_RECORD) {
    writeFileSync(
      process.env.LLP_NDI_RECEIVE_RECORD,
      JSON.stringify(
        stats,
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2,
      ),
    );
  }
  console.log('Receiver statistics:', stats);
  if (!saved) throw new Error('No transparent lyric frame received');
} finally {
  if (receiver) recvDestroy(receiver);
  if (finder) findDestroy(finder);
  destroy();
  lib.unload();
}
