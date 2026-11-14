const {createPacer} = require('./pacer.cjs');
const {Buffer} = require('node:buffer');
const process = require('node:process');
const {create} = require('./d3d.cjs');
const {openReal, frameRate} = require('./ndi-library.cjs');
const {applyDirty} = require('./dirty.cjs');
const DXGI_FORMAT_R8G8B8A8_UNORM = 28;
const DXGI_FORMAT_B8G8R8A8_UNORM = 87;
const frame = Buffer.alloc(1920 * 1080 * 4);
let reader;
let sender;
let hasFrame = false;
let announced = false;
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
    pacer.stop();
    sender?.close();
    reader?.close();
    process.exit(0);
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
