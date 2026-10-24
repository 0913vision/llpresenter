import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {describe, expect, it} from 'vitest';
import electronViteConfig from '../../electron.vite.config';
import {galleryPort, RENDERER_ALIASES} from './vite.config.mts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const CONFIG_URL = pathToFileURL(
  resolve(import.meta.dirname, 'vite.config.mts'),
).href;

// NOTE(0913vision): Starting Vite takes a few seconds, more on a loaded PC.
const SERVER_TIMEOUT_MS = 120_000;

// NOTE(0913vision): The server runs in its own Node process with a resolve
// hook that records every import of electron or electron-vite. Electron can't
// start without its package, so an empty list proves the gallery never starts
// it. The script imports the config itself, because Vite loads a config file
// where the hook can't see it.
const SERVE_SCRIPT = `
import {registerHooks} from 'node:module';
const electronImports = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^electron(-vite)?(\\/|$)/.test(specifier)) electronImports.push(specifier);
    return nextResolve(specifier, context);
  },
});
const {createServer} = await import('vite');
const {default: config} = await import(${JSON.stringify(CONFIG_URL)});
const server = await createServer({
  ...config,
  configFile: false,
  logLevel: 'silent',
  server: {...config.server, port: 0},
});
await server.listen();
const {port} = server.httpServer.address();
const response = await fetch('http://127.0.0.1:' + port + '/gallery.html');
const page = await response.text();
await server.close();
console.log(JSON.stringify({status: response.status, page, electronImports}));
`;

interface ServeResult {
  readonly status: number;
  readonly page: string;
  readonly electronImports: readonly string[];
}

function isServeResult(value: unknown): value is ServeResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'page' in value &&
    'electronImports' in value
  );
}

async function serveGalleryOnce(): Promise<ServeResult> {
  const {stdout} = await promisify(execFile)(
    process.execPath,
    ['--input-type=module', '-e', SERVE_SCRIPT],
    {cwd: REPO_ROOT},
  );
  const result: unknown = JSON.parse(stdout.trim().split('\n').at(-1) ?? '');
  if (!isServeResult(result)) throw new Error(`unexpected output: ${stdout}`);
  return result;
}

describe('npm run gallery', () => {
  it('runs plain Vite with the gallery config', async () => {
    const manifest: unknown = JSON.parse(
      await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8'),
    );
    expect(manifest).toMatchObject({
      scripts: {gallery: 'vite --config scripts/gallery/vite.config.mts'},
    });
  });

  it(
    'serves gallery.html without ever loading Electron',
    {timeout: SERVER_TIMEOUT_MS},
    async () => {
      const {status, page, electronImports} = await serveGalleryOnce();
      expect(status).toBe(200);
      expect(page).toMatch(/<html/i);
      expect(electronImports).toEqual([]);
    },
  );

  it('resolves imports with the same aliases as the renderer build', () => {
    expect(electronViteConfig).toMatchObject({
      renderer: {resolve: {alias: RENDERER_ALIASES}},
    });
  });

  it('listens on LLP_DEV_PORT, or 5173 without it', () => {
    expect(galleryPort({LLP_DEV_PORT: '5186'})).toBe(5186);
    expect(galleryPort({})).toBe(5173);
  });
});
