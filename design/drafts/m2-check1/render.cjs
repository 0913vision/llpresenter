const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {app, BrowserWindow} = require('electron');

assert.equal(process.env.LLP_TEST_WINDOWS, 'offscreen');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.on('window-all-closed', () => {});
const output = path.join(__dirname, 'renders');
const repo = path.resolve(__dirname, '../../..');
const deadline = setTimeout(() => {
  console.error('Draft rendering exceeded its two-minute deadline');
  app.exit(1);
}, 120000);

const pages = [
  {page: 'previews', width: 1032, height: 840},
  {page: 'headers', width: 936, height: 800},
  {page: 'type-today', width: 1920, height: 1080},
  {page: 'type-windows', width: 1920, height: 1080},
  {page: 'type-pair', width: 3840, height: 1144},
];

function previewSnapshot() {
  return [...document.querySelectorAll('.preview-draft')].map(panel => ({
    names: [...panel.querySelectorAll('.slot-caption')].map(
      label => label.textContent,
    ),
    selected: panel
      .querySelector('[aria-pressed="true"]')
      ?.getAttribute('aria-label'),
    large: panel
      .querySelector('[data-large-screen]')
      ?.getAttribute('data-large-screen'),
    pictures: panel.querySelectorAll('[data-draft-picture]').length,
    markers: panel.querySelectorAll('[data-selected-marker]').length,
    slots: [...panel.querySelectorAll('.screen-slot')].map(slot => {
      const rect = slot.getBoundingClientRect();
      return {x: rect.x, y: rect.y, width: rect.width};
    }),
  }));
}

function fontAudit() {
  const excluded =
    '[class*="_canvas_"], [class*="_screen_"], [data-draft-picture]';
  const labels = [...document.querySelectorAll('body *')].filter(
    element =>
      !element.closest(excluded) &&
      [...element.childNodes].some(
        node =>
          node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '',
      ),
  );
  return {
    viewport: {width: innerWidth, height: innerHeight, scale: devicePixelRatio},
    body: getComputedStyle(document.body).font,
    belowTwelve: labels
      .filter(element => parseFloat(getComputedStyle(element).fontSize) < 12)
      .map(element => ({
        text: element.textContent.trim(),
        size: getComputedStyle(element).fontSize,
      })),
    row: getComputedStyle(document.querySelector('[role="option"]')).font,
    panelTab: getComputedStyle(document.querySelector('[data-draft-tab]')).font,
    badge: [...document.querySelectorAll('span')]
      .filter(element => element.textContent === 'LIVE')
      .map(element => getComputedStyle(element).font),
  };
}

function headerAudit() {
  return {
    heights: [
      ...document.querySelectorAll(
        '.header-capture > section > div:first-child',
      ),
    ].map(header => header.getBoundingClientRect().height),
    longNames: [
      ...document.querySelectorAll('.long-name-label + .service-header'),
    ].map(header => {
      const name = header.querySelector('.service-name > span:first-child');
      return {
        clipped: name.scrollWidth > name.clientWidth,
        overflow: getComputedStyle(name).textOverflow,
        fullTitle: header.querySelector('button').title === name.textContent,
      };
    }),
  };
}

async function capture(window, filename, rect) {
  const bitmap = await window.webContents.capturePage(rect);
  const size = bitmap.getSize();
  assert.ok(size.width > 0 && size.height > 0);
  fs.writeFileSync(path.join(output, filename), bitmap.toPNG());
  console.log(`${filename}: ${size.width} x ${size.height}`);
  return size;
}

async function checkPreviewInteractions(window) {
  const initial = await window.webContents.executeJavaScript(
    `(${previewSnapshot.toString()})()`,
  );
  assert.deepEqual(
    initial.map(panel => panel.names),
    [
      ['본 화면', '무대 화면', '방송 자막'],
      ['본 화면', '무대 화면', '방송 자막'],
    ],
  );
  assert.deepEqual(
    initial.map(panel => panel.pictures),
    [4, 3],
  );
  assert.deepEqual(
    initial.map(panel => panel.markers),
    [0, 1],
  );
  for (const name of ['본 화면', '방송 자막', '무대 화면']) {
    await window.webContents.executeJavaScript(`
      document.querySelectorAll('.preview-draft').forEach(panel => {
        [...panel.querySelectorAll('.screen-slot')].find(button =>
          button.getAttribute('aria-label') === ${JSON.stringify(`${name} 미리보기`)}).click();
      });
      new Promise(resolve => requestAnimationFrame(() => resolve()));
    `);
    const next = await window.webContents.executeJavaScript(
      `(${previewSnapshot.toString()})()`,
    );
    for (let index = 0; index < next.length; index++) {
      assert.deepEqual(next[index].names, initial[index].names);
      assert.deepEqual(next[index].slots, initial[index].slots);
      assert.equal(next[index].large, name);
      assert.equal(next[index].selected, `${name} 미리보기`);
      assert.equal(next[index].pictures, index === 0 ? 4 : 3);
    }
  }
  return initial;
}

async function render() {
  const {createServer} = await import('vite');
  const {default: react} = await import('@vitejs/plugin-react');
  const server = await createServer({
    configFile: false,
    root: __dirname,
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': path.join(repo, 'src/renderer/src'),
        '@shared': path.join(repo, 'src/shared'),
      },
    },
    server: {host: '127.0.0.1', port: 5186, strictPort: true, open: false},
    logLevel: 'error',
  });
  fs.mkdirSync(output, {recursive: true});
  let window;
  const report = {};
  try {
    await server.listen();
    window = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      frame: false,
      useContentSize: true,
      width: 1920,
      height: 1080,
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    const errors = [];
    window.webContents.on('console-message', details => {
      if (details.level === 'error') errors.push(details.message);
    });
    for (const {page, width, height} of pages) {
      window.setContentSize(width, height);
      await window.loadURL(`http://127.0.0.1:5186/?page=${page}`);
      await window.webContents.executeJavaScript(`
        (async () => {
          await document.fonts.ready;
          if (${JSON.stringify(page)} === 'type-pair') {
            await Promise.all([...document.querySelectorAll('.type-pair img')].map(image => image.decode()));
          }
          await new Promise(resolve => setTimeout(resolve, 250));
        })()
      `);
      if (page === 'previews')
        report.previews = await checkPreviewInteractions(window);
      if (page === 'headers') {
        report.headers = await window.webContents.executeJavaScript(
          `(${headerAudit.toString()})()`,
        );
        assert.deepEqual(report.headers.heights, [34, 34, 52]);
        assert.deepEqual(report.headers.longNames, [
          {clipped: true, overflow: 'ellipsis', fullTitle: true},
          {clipped: true, overflow: 'ellipsis', fullTitle: true},
        ]);
      }
      if (page === 'type-pair') {
        report.pair = await window.webContents.executeJavaScript(`
          [...document.querySelectorAll('.type-pair img')].map(image => ({
            loaded: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
            width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height,
          }));
        `);
        assert.deepEqual(
          report.pair,
          Array.from({length: 2}, () => ({
            loaded: true,
            naturalWidth: 1920,
            naturalHeight: 1080,
            width: 1920,
            height: 1080,
          })),
        );
      }
      if (page.startsWith('type-') && page !== 'type-pair') {
        report[page] = await window.webContents.executeJavaScript(
          `(${fontAudit.toString()})()`,
        );
        assert.deepEqual(report[page].viewport, {
          width: 1920,
          height: 1080,
          scale: 1,
        });
        if (page === 'type-windows')
          assert.deepEqual(report[page].belowTwelve, []);
      }
      const dimensions = await capture(window, `${page}.png`);
      assert.deepEqual(dimensions, {width, height});
      if (page === 'previews' || page === 'headers') {
        const crops = await window.webContents.executeJavaScript(`
          [...document.querySelectorAll('[data-capture]')].map(element => {
            const rect = element.getBoundingClientRect();
            return {name: element.dataset.capture, x: Math.floor(rect.x), y: Math.floor(rect.y),
              width: Math.ceil(rect.width), height: Math.ceil(rect.height)};
          });
        `);
        for (const {name, ...rect} of crops)
          await capture(window, `${name}.png`, rect);
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'checks.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(
      'All draft layout, interaction, font, and capture checks passed.',
    );
  } finally {
    window?.destroy();
    await server.close();
    clearTimeout(deadline);
  }
}

app
  .whenReady()
  .then(render)
  .then(
    () => app.exit(0),
    error => {
      console.error(error);
      app.exit(1);
    },
  );
