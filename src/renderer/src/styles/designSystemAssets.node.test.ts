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

const TYPE_SCALE = [
  ['heading', '18px', '24px', 600],
  ['title', '14px', '20px', 600],
  ['body', '14px', '20px', 400],
  ['body-strong', '14px', '20px', 600],
  ['label', '12px', '16px', 400],
  ['label-strong', '14px', '20px', 600],
  ['band', '14px', '20px', 600],
  ['caption', '12px', '16px', 400],
  ['caption-strong', '14px', '20px', 600],
  ['toolbar-label', '12px', '16px', 400],
  ['micro', '12px', '16px', 400],
  ['thumb-lyrics', '4.4cqw', '1.45', 700],
] as const;

const designCss = readFileSync(TOKENS_CSS, 'utf8');
const appCss = readFileSync(
  resolve(REPOSITORY, 'src/renderer/src/styles/tokens.css'),
  'utf8',
);

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

describe('chosen Windows type scale', () => {
  it('keeps the selected scale in the token source without changing output-relative lyrics', () => {
    const source: unknown = JSON.parse(
      readFileSync(resolve(PROJECT, 'tokens.json'), 'utf8'),
    );
    expect(source).toMatchObject({
      type: {
        groups: [
          {
            family: 'ui',
            styles: TYPE_SCALE.map(
              ([name, fontSize, lineHeight, fontWeight]) => ({
                name,
                fontSize,
                lineHeight,
                fontWeight,
              }),
            ),
          },
        ],
      },
    });
  });

  it.each(TYPE_SCALE)(
    'ships the chosen %s shorthand and preview class in both CSS copies',
    (name, size, lineHeight, weight) => {
      for (const css of [designCss, appCss]) {
        expect(css).toContain(
          `--type-${name}: ${weight} ${size}/${lineHeight} var(--font-ui);`,
        );
        const rule = new RegExp(`\\.${name}\\s*\\{([^}]+)\\}`).exec(css)?.[1];
        expect(rule).toMatch(new RegExp(`font-size:\\s*${size};`));
        expect(rule).toMatch(new RegExp(`line-height:\\s*${lineHeight};`));
        expect(rule).toMatch(new RegExp(`font-weight:\\s*${weight};`));
      }
    },
  );

  it('never ships a UI text token below 12px', () => {
    const uiToken = /--type-[\w-]+:\s*\d+\s+(\d+(?:\.\d+)?)px\//g;
    for (const css of [designCss, appCss]) {
      const sizes = [...css.matchAll(uiToken)].map(([, size = '0']) =>
        Number(size),
      );
      expect(sizes).toHaveLength(TYPE_SCALE.length - 1);
      expect(sizes.every(size => size >= 12)).toBe(true);
    }
  });
});
