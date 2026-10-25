const assert = require('node:assert/strict');
const fs = require('node:fs');
const {wrap} = require('node:module');
const path = require('node:path');
const {test} = require('node:test');
const {Script} = require('node:vm');

const sourcePath = path.join(__dirname, 'render.cjs');
const source = fs.readFileSync(sourcePath, 'utf8');

function runBootstrap(flag) {
  const calls = {exits: [], errors: [], ready: 0, windows: 0, timers: []};
  const app = {
    exit: code => {
      calls.exits.push(code);
    },
    disableHardwareAcceleration: () => {},
    commandLine: {appendSwitch: () => {}},
    on: () => {},
    whenReady: () => {
      calls.ready++;
      return new Promise(() => {});
    },
  };
  const fakeRequire = name => {
    if (name === 'electron') {
      return {
        app,
        BrowserWindow: class {
          constructor() {
            calls.windows++;
            assert.fail('Bootstrap must not construct a browser window');
          }
        },
      };
    }
    if (['node:assert/strict', 'node:fs', 'node:path'].includes(name)) {
      return require(name);
    }
    assert.fail(`Unexpected bootstrap import: ${name}`);
  };
  const context = {
    process: {env: flag === undefined ? {} : {LLP_TEST_WINDOWS: flag}},
    console: {error: message => calls.errors.push(message)},
    setTimeout: (_callback, milliseconds) => {
      calls.timers.push(milliseconds);
      return calls.timers.length;
    },
    clearTimeout: () => {},
  };
  const bootstrap = new Script(wrap(source), {
    filename: sourcePath,
  }).runInNewContext(context);
  assert.doesNotThrow(() => {
    bootstrap({}, fakeRequire, {exports: {}}, sourcePath, __dirname);
  });
  return calls;
}

for (const flag of [undefined, '', 'off', 'OFFSCREEN']) {
  test(`rejects ${flag === undefined ? 'missing' : JSON.stringify(flag)} window mode without throwing or starting Electron work`, () => {
    const calls = runBootstrap(flag);
    assert.deepEqual(calls.exits, [1]);
    assert.equal(calls.errors.length, 1);
    assert.match(calls.errors[0], /LLP_TEST_WINDOWS=offscreen/);
    assert.equal(calls.ready, 0);
    assert.equal(calls.windows, 0);
    assert.deepEqual(calls.timers, []);
  });
}

test('accepts offscreen mode and waits for readiness before rendering', () => {
  const calls = runBootstrap('offscreen');
  assert.deepEqual(calls.exits, []);
  assert.deepEqual(calls.errors, []);
  assert.equal(calls.ready, 1);
  assert.equal(calls.windows, 0);
  assert.equal(calls.timers.length, 1);
});
