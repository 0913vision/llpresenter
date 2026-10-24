import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

const REPOSITORY = resolve(import.meta.dirname, '../../../..');
const TOKENS_CSS = resolve(REPOSITORY, 'design/system/project/tokens.css');
const PROJECT = dirname(TOKENS_CSS);
const LICENSE = resolve(PROJECT, 'fonts/LICENSE.txt');
const APP_FONT = resolve(
  REPOSITORY,
  'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2',
);
const APP_FONT_FAMILY = 'Pretendard Variable';
const OFL_TITLE = 'SIL OPEN FONT LICENSE Version 1.1';

const FONT_FACE = /@font-face\s*\{([^}]*)\}/g;
const FAMILY = /font-family:\s*["']?([^;"']+)["']?/;
const SOURCE = /src:\s*url\(["']?([^"')]+)["']?\)/;

interface FontFace {
  readonly family: string;
  readonly url: string;
}

function fontFaces(css: string): FontFace[] {
  return [...css.matchAll(FONT_FACE)].map(([, body = '']) => ({
    family: FAMILY.exec(body)?.[1]?.trim() ?? '',
    url: SOURCE.exec(body)?.[1] ?? '',
  }));
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const faces = fontFaces(readFileSync(TOKENS_CSS, 'utf8'));

describe('design system assets', () => {
  it('ships every font file that tokens.css loads', () => {
    expect(faces.length).toBeGreaterThan(0);
    const missing = faces.filter(
      face => !existsSync(resolve(PROJECT, face.url)),
    );
    expect(missing).toEqual([]);
  });

  it('draws the preview cards in the same Pretendard file as the app', () => {
    const pretendard = faces.find(face => face.family === APP_FONT_FAMILY);
    expect(pretendard).toBeDefined();
    const url = pretendard?.url ?? '';
    expect(sha256(resolve(PROJECT, url))).toBe(sha256(APP_FONT));
  });

  it('ships the OFL text next to the font', () => {
    expect(readFileSync(LICENSE, 'utf8')).toContain(OFL_TITLE);
  });
});
