import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {describe, expect, it} from 'vitest';

// NOTE(0913vision): Spec 08, "What must never happen during a service". These
// scan the source for what the app must never contain: an updater, a toast, a
// remote network call, a window question on an output, or a page that reaches out.

const ROOT = join(__dirname, '..', '..');
const SOURCE = join(ROOT, 'src');

function filesUnder(folder: string, extensions: readonly string[]): string[] {
  return readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return filesUnder(path, extensions);
    return extensions.some(extension => name.endsWith(extension)) ? [path] : [];
  });
}

function mentions(pattern: RegExp, files: readonly string[]): string[] {
  return files
    .filter(file => pattern.test(readFileSync(file, 'utf8')))
    .map(file => relative(ROOT, file).split(sep).join('/'));
}

const code = filesUnder(SOURCE, ['.ts', '.tsx']);

describe('never during a service', () => {
  it('has no updater: nothing installs or restarts the app by itself', () => {
    expect(mentions(/autoUpdater|electron-updater|squirrel/i, code)).toEqual(
      [],
    );
    const manifest = readFileSync(join(ROOT, 'package.json'), 'utf8');
    expect(manifest).not.toMatch(/electron-updater|update-electron-app/);
  });

  it('shows no Windows toast: nothing builds an Electron Notification', () => {
    expect(
      mentions(
        /import[^;]*\bNotification\b[^;]*from 'electron'|new Notification\(/,
        filesUnder(join(SOURCE, 'main'), ['.ts']),
      ),
    ).toEqual([]);
  });

  it('allows only the loopback LLM transport and no remote address in the code', () => {
    const productCode = code.filter(file => !file.includes('gallery'));
    expect(
      mentions(
        /\bfetch\(|XMLHttpRequest|new WebSocket|net\.(request|fetch)|https?\.(get|request)\(/,
        productCode,
      ),
    ).toEqual(['src/main/bible/llm/http.ts']);
    expect(
      mentions(
        /https?:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/,
        productCode,
      ),
    ).toEqual([]);
  });

  it('lets no page load from a remote origin', () => {
    const pages = filesUnder(join(SOURCE, 'renderer'), ['.html']);
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      const html = readFileSync(page, 'utf8');
      const policy = /Content-Security-Policy"\s+content="([^"]*)"/.exec(html);
      expect(policy?.[1], page).toBeDefined();
      expect(policy?.[1], page).toMatch(/default-src 'self'/);
      expect(policy?.[1], page).not.toMatch(/https?:|\*/);
    }
  });

  it('keeps the output page free of the control UI: no dialog, menu, tooltip, or notification', () => {
    const output = filesUnder(join(SOURCE, 'renderer', 'src', 'output'), [
      '.ts',
      '.tsx',
    ]);
    expect(output.length).toBeGreaterThan(0);
    expect(
      mentions(/@renderer\/(ui|app|features)\b|from 'react'|react-dom/, output),
    ).toEqual([]);
  });

  it('asks nothing natively: main shows no message box or error box', () => {
    expect(
      mentions(
        /dialog\.(showMessageBox|showMessageBoxSync|showErrorBox)/,
        filesUnder(join(SOURCE, 'main'), ['.ts']),
      ),
    ).toEqual([]);
  });
});
