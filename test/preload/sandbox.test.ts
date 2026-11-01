import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {loadConfigFromFile, PreloadConfigFactory} from 'electron-vite';
import {build} from 'vite';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

// NOTE(0913vision): A sandboxed preload can require only electron and a few
// Node polyfills, never a package from node_modules. Building the real preload
// with the real config and running it with only those modules catches a
// dependency that the build left external.
const SANDBOX_MODULES = new Set(['electron', 'events', 'timers', 'url']);
const BUILD_TIMEOUT_MS = 60_000;

let outDir = '';

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'llp-preload-'));
  const {config} = await loadConfigFromFile(
    {command: 'build', mode: 'production'},
    'electron.vite.config.ts',
  );
  const preload = await new PreloadConfigFactory(
    {...config.preload, build: {...config.preload?.build, outDir}},
    {logLevel: 'silent'},
    {},
  ).build();
  await build(preload);
}, BUILD_TIMEOUT_MS);

afterAll(async () => {
  await rm(outDir, {recursive: true, force: true});
});

function mockElectron(exposed: Map<string, unknown>) {
  return {
    contextBridge: {
      exposeInMainWorld: (key: string, api: unknown) => {
        exposed.set(key, api);
      },
    },
    ipcRenderer: {
      send: () => undefined,
      invoke: () => Promise.resolve({}),
      on: () => undefined,
      removeListener: () => undefined,
    },
  };
}

describe('the built preload', () => {
  it('runs with only the modules a sandboxed preload may require', async () => {
    const code = await readFile(join(outDir, 'index.js'), 'utf8');
    const exposed = new Map<string, unknown>();
    const required: string[] = [];
    const sandboxRequire = (name: string): unknown => {
      required.push(name);
      if (!SANDBOX_MODULES.has(name)) {
        throw new Error(`A sandboxed preload can't require ${name}`);
      }
      return name === 'electron' ? mockElectron(exposed) : {};
    };
    const module = {exports: {}};

    runInNewContext(code, {
      require: sandboxRequire,
      module,
      exports: module.exports,
      console,
    });

    expect(required.filter(name => !SANDBOX_MODULES.has(name))).toEqual([]);
    expect(exposed.has('llp')).toBe(true);
  });
});
