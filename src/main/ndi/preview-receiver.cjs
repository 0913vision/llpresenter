const process = require('node:process');
const os = require('node:os');
const path = require('node:path');
const koffi = require('koffi');
const {setTimeout, clearTimeout} = require('node:timers');
const {previewPixels} = require('./previewPixels.cjs');
const {takeLatestFrame} = require('./previewFrames.cjs');

let stopped = false;
let inFlight = false;
let finder;
let receiver;
let lib;
let timer;
let due = 0;
let sourceName;
let findSources;
let capture;
let freeVideo;

function start(name) {
  sourceName = name;
  const dir = process.env.NDI_RUNTIME_DIR_V6;
  if (!dir) throw Error('NDI runtime missing');
  lib = koffi.load(path.join(dir, 'Processing.NDI.Lib.x64.dll'));
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
    p_data: 'uint8_t *',
    line_stride_in_bytes: 'int',
    p_metadata: 'const char *',
    timestamp: 'int64_t',
  });
  if (!lib.func('NDIlib_initialize', 'bool', [])()) {
    throw Error('NDI initialization failed');
  }
  finder = lib.func('NDIlib_find_create_v2', 'void *', [
    koffi.pointer(findSettings),
  ])({show_local_sources: true, p_groups: null, p_extra_ips: null});
  if (!finder) throw Error('NDI discovery failed');
  const get = lib.func(
    'NDIlib_find_get_current_sources',
    koffi.pointer(source),
    ['void *', koffi.out(koffi.pointer('uint32_t'))],
  );
  const create = lib.func('NDIlib_recv_create_v3', 'void *', [
    koffi.pointer(recvSettings),
  ]);
  capture = lib.func('NDIlib_recv_capture_v3', 'int', [
    'void *',
    koffi.out(koffi.pointer(video)),
    'void *',
    'void *',
    'uint32_t',
  ]);
  freeVideo = lib.func('NDIlib_recv_free_video_v2', 'void', [
    'void *',
    koffi.pointer(video),
  ]);
  findSources = () => {
    const count = [0];
    const ptr = get(finder, count);
    if (!ptr || !count[0]) return;
    const sources = koffi.decode(ptr, koffi.array(source, count[0]));
    const wanted = `${os.hostname()} (${sourceName})`.toLowerCase();
    const match = sources.find(
      value => value.p_ndi_name?.toLowerCase() === wanted,
    );
    if (match) {
      receiver = create({
        source_to_connect_to: match,
        color_format: 0,
        bandwidth: 0,
        allow_video_fields: false,
        p_ndi_recv_name: 'LoveLight preview',
      });
    }
  };
  tick();
}

function captureFrame() {
  const image = takeLatestFrame(
    () => {
      const next = {};
      return capture(receiver, next, null, null, 0) === 1 ? next : null;
    },
    previous => freeVideo(receiver, previous),
  );
  if (image === null) return;
  try {
    const {xres: width, yres: height, line_stride_in_bytes: stride} = image;
    if (width <= 0 || height <= 0 || stride < width * 4) return;
    const source = koffi.decode(
      image.p_data,
      koffi.array('uint8_t', stride * height, 'Typed'),
    );
    const pixels = previewPixels(
      source,
      width,
      height,
      stride,
      image.FourCC === 0x41524742,
    );
    inFlight = true;
    due = Date.now() + 200;
    process.parentPort.postMessage({type: 'frame', frame: pixels});
  } finally {
    freeVideo(receiver, image);
  }
}

function tick() {
  if (stopped) return;
  try {
    if (!receiver) findSources();
    if (receiver && !inFlight && Date.now() >= due) captureFrame();
  } catch (error) {
    process.parentPort.postMessage({type: 'error', message: String(error)});
    stopped = true;
    return;
  }
  timer = setTimeout(tick, receiver ? 20 : 500);
}

process.parentPort.on('message', event => {
  const message = event.data;
  if (message.type === 'start') {
    try {
      start(message.sourceName);
    } catch (error) {
      process.parentPort.postMessage({type: 'error', message: String(error)});
    }
  } else if (message.type === 'ack') {
    inFlight = false;
  } else if (message.type === 'stop') {
    stopped = true;
    clearTimeout(timer);
    if (receiver) lib.func('NDIlib_recv_destroy', 'void', ['void *'])(receiver);
    if (finder) lib.func('NDIlib_find_destroy', 'void', ['void *'])(finder);
    if (lib) lib.func('NDIlib_destroy', 'void', [])();
    process.exit(0);
  }
});
