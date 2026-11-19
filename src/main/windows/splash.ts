import {BrowserWindow} from 'electron';
import icon from '../../../build/icon-small.svg?raw';
import type {WindowMode} from './testWindows';

export type StartupStep =
  'settings' | 'content' | 'window' | 'renderer' | 'paint';

const steps: readonly StartupStep[] = [
  'settings',
  'content',
  'window',
  'renderer',
  'paint',
];
const states = new WeakMap<
  BrowserWindow,
  {done: Set<StartupStep>; loaded: boolean}
>();

/** Shows the selected launch design while the control window starts. */
export function createSplash(mode: WindowMode): BrowserWindow {
  const window = new BrowserWindow({
    width: 560,
    height: 240,
    frame: false,
    show: mode === 'normal',
    resizable: false,
    skipTaskbar: mode === 'offscreen',
    backgroundColor: '#1f4170',
    webPreferences: {
      offscreen: mode === 'offscreen',
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  states.set(window, {done: new Set(), loaded: false});
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;color:#fff;font-family:Pretendard,"Malgun Gothic",sans-serif;background:linear-gradient(135deg,#172f51,#24548d)}main{height:240px;display:flex;flex-direction:column;align-items:center;padding:20px 38px 20px}svg{width:104px;height:104px}h1{margin:8px 0 0;font-size:29px;font-weight:700;letter-spacing:-.5px}footer{width:100%;margin-top:18px;font-size:13px;color:#e1eaf6}.track{height:4px;background:#ffffff42;margin-top:10px}.bar{height:100%;width:0;background:#fff}
  </style><main>${icon}<h1>LoveLight Presenter</h1><footer><span id="status">설정 불러오는 중</span><div class="track" role="progressbar" aria-label="시작 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="bar"></div></div></footer></main></html>`;
  window.webContents.once('did-finish-load', () => {
    const state = states.get(window);
    if (state === undefined) return;
    state.loaded = true;
    renderProgress(window, state.done);
  });
  window
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    .catch((error: unknown) => console.error('Could not load splash', error));
  return window;
}

/** Records a completed startup milestone; out-of-order work is counted once. */
export function completeSplashStep(
  window: BrowserWindow,
  step: StartupStep,
): void {
  const state = states.get(window);
  if (state === undefined || window.isDestroyed()) return;
  state.done.add(step);
  if (state.loaded) renderProgress(window, state.done);
}

function renderProgress(window: BrowserWindow, done: Set<StartupStep>): void {
  const percent = Math.round((done.size / steps.length) * 100);
  const status = !done.has('settings')
    ? '설정 불러오는 중'
    : !done.has('content')
      ? '예배 불러오는 중'
      : '화면 준비 중';
  const code = `document.getElementById('status').textContent=${JSON.stringify(status)};document.querySelector('.bar').style.width='${percent}%';document.querySelector('.track').setAttribute('aria-valuenow','${percent}')`;
  window.webContents.executeJavaScript(code).catch(() => undefined);
}
