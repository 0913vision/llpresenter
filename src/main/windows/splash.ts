import {BrowserWindow, nativeImage} from 'electron';
import {writeFileSync} from 'node:fs';
import {appIconPath} from './appIcon';
import type {WindowMode} from './testWindows';

export function createSplash(mode: WindowMode): BrowserWindow {
  const started = process.hrtime.bigint();
  const variant = process.env['LLP_SPLASH_VARIANT'] ?? 'a';
  const icon = nativeImage
    .createFromPath(appIconPath)
    .resize({width: 72, height: 72})
    .toDataURL();
  const window = new BrowserWindow({
    width: 560,
    height: 300,
    frame: false,
    show: false,
    resizable: false,
    skipTaskbar: mode === 'offscreen',
    backgroundColor: '#1c1c1c',
    webPreferences: {offscreen: mode === 'offscreen', sandbox: true},
  });
  if (process.env['LLP_SPLASH_TIMING'] === '1') {
    console.info(
      `Splash window created in ${Number(process.hrtime.bigint() - started) / 1e6} ms`,
    );
  }
  const layouts: Record<string, string> = {
    a: 'main{align-items:center;text-align:center} img{width:72px} h1{font-size:24px} footer{width:100%}',
    b: 'main{align-items:flex-start;text-align:left} img{width:56px} h1{font-size:27px} footer{width:100%}',
    c: 'main{align-items:center;text-align:center;background:linear-gradient(135deg,#1c1c1c,#1f4170)} img{width:64px} h1{font-size:22px} footer{width:70%}',
  };
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#1c1c1c;color:#ececec;font-family:Pretendard,"Malgun Gothic",sans-serif}main{height:300px;padding:34px 40px;display:flex;flex-direction:column;justify-content:center;gap:12px}h1{margin:0;font-weight:700}footer{margin-top:auto;color:#b4b4b4;font-size:13px}.track{height:3px;background:#3a3a3a;margin-top:12px;overflow:hidden}.bar{height:100%;width:38%;background:#3d8bf0;animation:load 1.4s infinite alternate ease-in-out}@keyframes load{from{transform:translateX(0)}to{transform:translateX(160%)}}${layouts[variant] ?? layouts.a}
  </style><main><img src="${icon}"><h1>LoveLight Presenter</h1><footer>화면 준비 중<div class="track"><div class="bar"></div></div></footer></main></html>`;
  window
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    .catch((error: unknown) => console.error('Could not load splash', error));
  if (process.env['LLP_SPLASH_TIMING'] === '1') {
    window.webContents.once('did-finish-load', () => {
      console.info(
        `Splash load took ${Number(process.hrtime.bigint() - started) / 1e6} ms`,
      );
    });
  }
  window.once('ready-to-show', () => {
    if (process.env['LLP_SPLASH_TIMING'] === '1') {
      console.info(`Splash ready at ${Math.round(process.uptime() * 1000)} ms`);
      console.info(
        `Splash creation took ${Number(process.hrtime.bigint() - started) / 1e6} ms`,
      );
    }
    if (mode === 'normal') window.show();
    else {
      const path = process.env['LLP_SPLASH_CAPTURE'];
      if (path) {
        window.webContents.capturePage().then(
          image => writeFileSync(path, image.toPNG()),
          (error: unknown) => console.error('Could not capture splash', error),
        );
      }
    }
  });
  return window;
}
