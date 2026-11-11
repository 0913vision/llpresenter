// NOTE(0913vision): This ABI wrapper loads only in the utility process.
const process = require('node:process');
const path = require('node:path');
const fs = require('node:fs');

function runtimePath(env = process.env) {
  const dir = env.NDI_RUNTIME_DIR_V6;
  return dir ? path.join(dir, 'Processing.NDI.Lib.x64.dll') : null;
}

function openReal(env = process.env) {
  const dll = runtimePath(env);
  if (!dll || !fs.existsSync(dll)) throw new Error('NDI_RUNTIME_MISSING');
  return openBinding(require('koffi'), dll, env.LLP_NDI_SOURCE_NAME);
}

function openBinding(koffi, dll, name = null) {
  const lib = koffi.load(dll);
  const createSettings = koffi.struct({
    p_ndi_name: 'const char *',
    p_groups: 'const char *',
    clock_video: 'bool',
    clock_audio: 'bool',
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
  const initialize = lib.func('NDIlib_initialize', 'bool', []);
  const destroy = lib.func('NDIlib_destroy', 'void', []);
  const create = lib.func('NDIlib_send_create', 'void *', [
    koffi.pointer(createSettings),
  ]);
  const send = lib.func('NDIlib_send_send_video_async_v2', 'void', [
    'void *',
    koffi.pointer(video),
  ]);
  const close = lib.func('NDIlib_send_destroy', 'void', ['void *']);
  if (!initialize()) throw new Error('NDI initialization failed');
  const sender = create({
    p_ndi_name: name,
    p_groups: null,
    clock_video: false,
    clock_audio: false,
  });
  if (!sender) {
    destroy();
    throw new Error('NDI sender creation failed');
  }
  return {
    sync() {
      send(sender, null);
    },
    send(data) {
      send(sender, {
        xres: 1920,
        yres: 1080,
        FourCC: 0x41524742,
        frame_rate_N: 30,
        frame_rate_D: 1,
        picture_aspect_ratio: 16 / 9,
        frame_format_type: 1,
        timecode: 9223372036854775807n,
        p_data: data,
        line_stride_in_bytes: 1920 * 4,
        p_metadata: null,
        timestamp: 0,
      });
    },
    close() {
      close(sender);
      destroy();
      lib.unload();
    },
  };
}

module.exports = {runtimePath, openReal};
