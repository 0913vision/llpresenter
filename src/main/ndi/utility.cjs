const {createPacer} = require('./pacer.cjs');
const {openReal} = require('./ndi-library.cjs');
const process = require('node:process');
const {Buffer} = require('node:buffer');
const {setInterval, clearInterval} = require('node:timers');
const {applyDirty} = require('./dirty.cjs');
const frame = Buffer.alloc(1920 * 1080 * 4);
let hasFrame = false;
let heartbeat;
const pacer = createPacer(() => sender.send(frame));
let sender;
try {
  require('koffi');
  process.parentPort.postMessage({type: 'native-loaded'});
  sender = openReal();
  process.parentPort.postMessage({type: 'ready'});
} catch (error) {
  process.parentPort.postMessage({
    type: 'error',
    message: String(error.message),
  });
}
process.parentPort.on('message', event => {
  const msg = event.data;
  if (msg.type === 'stop') {
    pacer.stop();
    clearInterval(heartbeat);
    sender?.close();
    process.exit(0);
  }
  if (msg.type !== 'frame' || !sender) return;
  // NOTE(0913vision): Synchronize NDI before editing its retained frame.
  if (hasFrame) sender.sync();
  applyDirty(frame, msg.data, {width: 1920, height: 1080});
  sender.send(frame);
  pacer.sent();
  hasFrame = true;
  process.parentPort.postMessage({type: 'sent'});
  if (!heartbeat) {
    heartbeat = setInterval(() => {
      process.parentPort.postMessage({type: 'heartbeat'});
    }, 1000);
  }
});
