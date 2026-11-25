const process = require('node:process');
const {setImmediate, setTimeout} = require('node:timers');
const {performance} = require('node:perf_hooks');
const {createPresenter} = require('./d3dPresenter.cjs');

// NOTE(0913vision): One output monitor per utility process. Present(1)
// blocks until that monitor takes the frame, so the loop runs at its refresh;
// messages are handled between frames.

const IDLE_MS = 16;
const REOPEN_LIMIT = 3;
const REOPEN_WINDOW_MS = 60_000;
let presenter = null;
let opened = null;
let reopenedAt = [];
// NOTE(0913vision): Every page frame carries the id the main process gave it,
// and every frame given in comes back as 'copied' with that id once the main
// process may free it: copied into the picture, or dropped with a window that
// went away. A frame that comes while one is copied waits; a newer one
// replaces it. So a window opened again never gets two frames at once (church,
// Nov 25: "a page frame is still being copied").
let copyingId = null;
let queuedFrame = null;
let wantShown = false;
let onTop = true;
let timer = null;
let mirrorEnabled = false;
let mirrorInFlight = false;
let mirrorDue = 0;
let mirrorDirty = false;
let mirrorPending = false;

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

/** Tells the main process it may free page frame `id`. */
function release(id) {
  post({type: 'copied', id});
}

function submitFrame(frame) {
  presenter.submit(frame.pid, frame.handle);
  copyingId = frame.id;
  mirrorDirty = true;
}

/** Copies a page frame now, or keeps it waiting while another is copied. */
function takeFrame(frame) {
  if (presenter === null) {
    release(frame.id);
    return;
  }
  if (copyingId === null) {
    submitFrame(frame);
    return;
  }
  if (queuedFrame !== null) release(queuedFrame.id);
  queuedFrame = frame;
}

/** Gives back the frames a closed presenter held. */
function dropFrames() {
  if (copyingId !== null) release(copyingId);
  if (queuedFrame !== null) release(queuedFrame.id);
  copyingId = null;
  queuedFrame = null;
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
      if (copyingId !== null) release(copyingId);
      copyingId = null;
      show();
      const next = queuedFrame;
      queuedFrame = null;
      if (next !== null) submitFrame(next);
    }
    const ended = presenter.takeEnded();
    if (ended !== null) post({type: 'transitioned', ...ended});
    const placed = presenter.keepPlaced(performance.now());
    if (placed?.lost === true) {
      // NOTE(0913vision): The window went away under the presenter (the 무대
      // window at the hourly 청중 TV dropout, church Nov 25). A new one opens
      // at the same place, and the main process paints the page for it.
      reopen();
      post({type: 'reopened'});
    } else if (placed !== null) {
      post({type: 'replaced', was: placed.was});
    }
  } catch (error) {
    fail(error);
    return;
  }
  schedule();
}

/** Opens the presenter window at `bounds`, the one before closed first. */
function open(bounds) {
  close();
  dropFrames();
  mirrorInFlight = false;
  mirrorPending = false;
  mirrorDue = 0;
  mirrorDirty = mirrorEnabled;
  opened = bounds;
  presenter = createPresenter({...bounds, topmost: onTop});
  if (mirrorEnabled) applyMirror();
}

/**
 * Opens the window again where it was, keeping whether it should show; a
 * window that keeps going away (REOPEN_LIMIT times a minute) is an error, and
 * the main process shows the screen in its output window instead.
 */
function reopen() {
  const now = performance.now();
  reopenedAt = [...reopenedAt.filter(at => now - at < REOPEN_WINDOW_MS), now];
  if (reopenedAt.length > REOPEN_LIMIT) {
    throw Error('the presenter window keeps going away');
  }
  if (opened !== null) open(opened);
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
        onTop = message.topmost !== false;
        open({...message.bounds, hz: message.hz});
        wantShown = false;
        post({type: 'ready'});
        schedule();
        break;
      }
      case 'frame':
        takeFrame({pid: message.pid, handle: message.handle, id: message.id});
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
    if (message.type === 'frame' && copyingId !== message.id) {
      release(message.id);
    }
  }
});
