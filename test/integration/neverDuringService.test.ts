import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {describe, expect, it} from 'vitest';

// NOTE(0913vision): Spec 08, "What must never happen during a service". These
// scan for forbidden output UI and network access outside the main-process
// adapters. Updater flow tests cover click-only installation and output guards.

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
  it('confines the updater dependency to one main-process adapter', () => {
    expect(mentions(/autoUpdater|electron-updater|squirrel/i, code)).toEqual([
      'src/main/update/electronUpdater.ts',
    ]);
    const manifest = readFileSync(join(ROOT, 'package.json'), 'utf8');
    expect(manifest).not.toMatch(/update-electron-app/);
  });

  it('shows no Windows toast: nothing builds an Electron Notification', () => {
    expect(
      mentions(
        /import[^;]*\bNotification\b[^;]*from 'electron'|new Notification\(/,
        filesUnder(join(SOURCE, 'main'), ['.ts']),
      ),
    ).toEqual([]);
  });

  it('limits network access to the loopback LLM and the live Bible adapter', () => {
    const productCode = code.filter(file => !file.includes('gallery'));
    expect(
      mentions(
        /\bfetch\(|XMLHttpRequest|new WebSocket|net\.(request|fetch)|https?\.(get|request)\(/,
        productCode,
      ),
    ).toEqual(['src/main/bible/liveChapter.ts', 'src/main/bible/llm/http.ts']);
    expect(
      mentions(
        /https?:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/,
        productCode,
      ),
    ).toEqual(['src/main/bible/liveChapter.ts']);
    const adapter = readFileSync(
      join(SOURCE, 'main/bible/liveChapter.ts'),
      'utf8',
    );
    expect(adapter.match(/https?:\/\/[a-z0-9.-]+\/[^?`'"\s]+/g)).toEqual([
      'https://www.bskorea.or.kr/bible/korbibReadpage.php',
    ]);
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
