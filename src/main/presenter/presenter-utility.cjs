const process = require('node:process');
const {setImmediate, setTimeout} = require('node:timers');
const {performance} = require('node:perf_hooks');
const {createPresenter} = require('./d3dPresenter.cjs');

// NOTE(0913vision): One output monitor per utility process. Present(1)
// blocks until that monitor takes the frame, so the loop runs at its refresh;
// messages are handled between frames.

const IDLE_MS = 16;
let presenter = null;
let wantShown = false;
let onTop = true;
let timer = null;
let mirrorEnabled = false;
let mirrorInFlight = false;
let mirrorDue = 0;
let mirrorDirty = false;
let mirrorPending = false;
let transitionSequence = 0;

function post(message) {
  process.parentPort.postMessage(message);
}

function fail(error) {
  post({type: 'error', message: String((error && error.stack) || error)});
}

function schedule() {
  if (timer !== null) return;
  const visible = presenter !== null && presenter.visible;
  timer = visible ? setImmediate(tick) : setTimeout(tick, IDLE_MS);
}

function applyMirror() {
  if (presenter === null) return;
  try {
    if (mirrorEnabled) presenter.startMirror();
    else presenter.stopMirror();
  } catch (error) {
    mirrorEnabled = false;
    presenter.stopMirror();
    post({type: 'mirror-error', message: String(error)});
  }
}

function captureMirror() {
  if (
    !mirrorEnabled ||
    presenter === null ||
    !presenter.visible ||
    mirrorInFlight
  ) {
    return;
  }
  try {
    const frame = mirrorPending ? presenter.takeMirror() : null;
    if (frame !== null) {
      mirrorPending = false;
      mirrorInFlight = true;
      mirrorDue = performance.now() + 100;
      post({type: 'mirror-frame', frame});
    } else if (
      !mirrorPending &&
      mirrorDirty &&
      performance.now() >= mirrorDue
    ) {
      if (presenter.requestMirror()) {
        mirrorDirty = false;
        mirrorPending = true;
      }
    }
  } catch (error) {
    mirrorEnabled = false;
    presenter.stopMirror();
    post({type: 'mirror-error', message: String(error)});
  }
}

function tick() {
  timer = null;
  if (presenter === null) return;
  try {
    const wasBusy = presenter.busy;
    presenter.frame();
    if (wasBusy || presenter.busy) mirrorDirty = true;
    captureMirror();
    if (presenter.copied()) {
      post({type: 'copied'});
      show();
    }
    if (wasBusy && !presenter.busy) {
      const intervals = presenter.takeIntervals();
      const late = intervals.filter(value => value > 25).length;
      const mean =
        intervals.reduce((sum, value) => sum + value, 0) /
        Math.max(1, intervals.length);
      post({
        type: 'transitioned',
        sequence: transitionSequence,
        frames: intervals.length,
        late,
        mean,
      });
    }
  } catch (error) {
    fail(error);
    return;
  }
  schedule();
}

function show() {
  if (presenter === null || !wantShown || presenter.visible) return;
  if (presenter.show(onTop)) post({type: 'shown'});
}

function close() {
  if (presenter === null) return;
  presenter.close();
  presenter = null;
}

process.parentPort.on('message', event => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'open': {
        close();
        mirrorInFlight = false;
        mirrorPending = false;
        mirrorDue = 0;
        mirrorDirty = mirrorEnabled;
        onTop = message.topmost !== false;
        presenter = createPresenter({
          ...message.bounds,
          hz: message.hz,
          topmost: onTop,
        });
        if (mirrorEnabled) applyMirror();
        wantShown = false;
        post({type: 'ready'});
        schedule();
        break;
      }
      case 'frame':
        if (presenter === null) break;
        presenter.submit(message.pid, message.handle);
        mirrorDirty = true;
        break;
      case 'show':
        onTop = message.topmost !== false;
        wantShown = true;
        if (presenter?.visible) presenter.setOnTop(onTop);
        show();
        mirrorDirty = true;
        break;
      case 'top':
        onTop = message.topmost !== false;
        presenter?.setOnTop(onTop);
        break;
      case 'hide':
        wantShown = false;
        presenter?.hide();
        break;
      case 'transition':
        transitionSequence = message.sequence;
        presenter?.transition(message);
        mirrorDirty = true;
        break;
      case 'mirror':
        mirrorEnabled = message.enabled === true;
        mirrorInFlight = false;
        mirrorPending = false;
        mirrorDue = 0;
        mirrorDirty = mirrorEnabled;
        applyMirror();
        break;
      case 'mirror-ack':
        mirrorInFlight = false;
        break;
      case 'stop':
        close();
        process.exit(0);
        break;
      default:
        break;
    }
  } catch (error) {
    fail(error);
    if (message.type === 'frame') post({type: 'copied'});
  }
});
