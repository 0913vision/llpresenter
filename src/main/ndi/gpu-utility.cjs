const {createPacer} = require('./pacer.cjs');
const {Buffer} = require('node:buffer');
const process = require('node:process');
const {create} = require('./d3d.cjs');
const {openReal, frameRate} = require('./ndi-library.cjs');
const {applyDirty} = require('./dirty.cjs');
const {performance} = require('node:perf_hooks');
const {setTimeout, clearTimeout} = require('node:timers');
const DXGI_FORMAT_R8G8B8A8_UNORM = 28;
const DXGI_FORMAT_B8G8R8A8_UNORM = 87;
const frame = Buffer.alloc(1920 * 1080 * 4);
let reader;
let sender;
let hasFrame = false;
let announced = false;
let mirrorEnabled = false;
let mirrorInFlight = false;
let mirrorDirty = false;
let mirrorDue = 0;
let mirrorTimer = null;

function mirror() {
  if (!mirrorEnabled || !mirrorDirty || mirrorInFlight || !hasFrame) return;
  const delay = mirrorDue - performance.now();
  if (delay > 0) {
    if (mirrorTimer === null) {
      mirrorTimer = setTimeout(() => {
        mirrorTimer = null;
        mirror();
      }, delay);
    }
    return;
  }
  const source = new Uint32Array(
    frame.buffer,
    frame.byteOffset,
    frame.length / 4,
  );
  const pixels = new Uint8Array(640 * 360 * 4);
  const target = new Uint32Array(pixels.buffer);
  for (let y = 0; y < 360; y++) {
    for (let x = 0; x < 640; x++) {
      const pixel = source[y * 3 * 1920 + x * 3];
      target[y * 640 + x] =
        (pixel & 0xff00ff00) | ((pixel & 255) << 16) | ((pixel >>> 16) & 255);
    }
  }
  mirrorDirty = false;
  mirrorInFlight = true;
  mirrorDue = performance.now() + 100;
  process.parentPort.postMessage({type: 'mirror-frame', frame: pixels});
}
const probe = process.env?.LLP_NDI_PROBE === '1';
const pacer = createPacer(() => sender.send(frame), frameRate());
try {
  require('koffi');
  process.parentPort.postMessage({type: 'native-loaded'});
  reader = create();
  sender = probe
    ? {
        sync() {},
        send(data) {
          process.parentPort.postMessage({
            type: 'pixels',
            data,
          });
        },
        close() {},
      }
    : openReal();
  process.parentPort.postMessage({type: 'ready'});
} catch (error) {
  process.parentPort.postMessage({
    type: 'error',
    message: String(error.stack || error),
  });
}
process.parentPort.on('message', event => {
  const msg = event.data;
  if (msg.type === 'stop') {
    if (mirrorTimer !== null) clearTimeout(mirrorTimer);
    pacer.stop();
    sender?.close();
    reader?.close();
    process.exit(0);
  }
  if (msg.type === 'mirror') {
    mirrorEnabled = msg.enabled === true;
    mirrorInFlight = false;
    mirrorDirty = mirrorEnabled;
    if (!mirrorEnabled && mirrorTimer !== null) {
      clearTimeout(mirrorTimer);
      mirrorTimer = null;
    }
    mirror();
    return;
  }
  if (msg.type === 'mirror-ack') {
    mirrorInFlight = false;
    mirror();
    return;
  }
  if (msg.type !== 'frame' || !reader || !sender) return;
  try {
    reader.read(msg.pid, msg.handle, msg.dirty, ({bytes, format, dirty}) => {
      if (
        format !== DXGI_FORMAT_B8G8R8A8_UNORM &&
        format !== DXGI_FORMAT_R8G8B8A8_UNORM
      ) {
        throw Error(`unsupported DXGI format ${format}`);
      }
      if (format === DXGI_FORMAT_R8G8B8A8_UNORM) {
        for (let i = 0; i < bytes.length; i += 4) {
          const red = bytes[i];
          bytes[i] = bytes[i + 2];
          bytes[i + 2] = red;
        }
      }
      if (hasFrame) sender.sync();
      applyDirty(frame, {...dirty, data: bytes}, {width: 1920, height: 1080});
    });
    hasFrame = true;
    process.parentPort.postMessage({type: 'copied'});
    sender.send(frame);
    mirrorDirty = true;
    mirror();
    if (!announced) {
      announced = true;
      process.parentPort.postMessage({type: 'live'});
    }
    if (!probe) pacer.sent();
  } catch (error) {
    process.parentPort.postMessage({
      type: 'error',
      message: String(error.stack || error),
    });
  }
});
