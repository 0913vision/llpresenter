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
  ['heading', '22px', '30px', 600],
  ['title', '18px', '26px', 600],
  ['body', '16px', '22px', 400],
  ['body-strong', '16px', '22px', 600],
  ['label', '14px', '20px', 400],
  ['label-strong', '16px', '22px', 600],
  ['band', '16px', '22px', 600],
  ['caption', '14px', '20px', 400],
  ['caption-strong', '16px', '22px', 600],
  ['toolbar-label', '14px', '20px', 400],
  ['micro', '14px', '20px', 400],
  ['thumb-lyrics', '4.4cqw', '1.45', 700],
] as const;

const TYPE_STYLES = TYPE_SCALE.map(
  ([name, fontSize, lineHeight, fontWeight]) => ({
    name,
    fontSize,
    lineHeight,
    fontWeight,
  }),
);

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

describe('1920x1080 UI type scale', () => {
  it('keeps the selected scale in the token source without changing output-relative lyrics', () => {
    const source: unknown = JSON.parse(
      readFileSync(resolve(PROJECT, 'tokens.json'), 'utf8'),
    );
    expect(source).toMatchObject({
      type: {
        groups: [
          {
            family: 'ui',
            styles: TYPE_STYLES,
          },
        ],
      },
    });
  });

  it.each(TYPE_STYLES)(
    'ships the chosen $name shorthand and preview class in both CSS copies',
    ({name, fontSize: size, lineHeight, fontWeight: weight}) => {
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

  it('never ships a UI text token below 14px, including micro', () => {
    const uiToken = /--type-[\w-]+:\s*\d+\s+(\d+(?:\.\d+)?)px\//g;
    for (const css of [designCss, appCss]) {
      const sizes = [...css.matchAll(uiToken)].map(([, size = '0']) =>
        Number(size),
      );
      expect(sizes).toHaveLength(TYPE_SCALE.length - 1);
      expect(sizes.every(size => size >= 14)).toBe(true);
    }
  });

  it('fits the larger lines inside their list and control heights', () => {
    const token = (name: string): number => {
      const value = new RegExp(`--${name}:\\s*(\\d+)px;`).exec(appCss)?.[1];
      if (value === undefined) throw new Error(`Missing ${name}`);
      return Number(value);
    };
    const bodyLine = Number(
      TYPE_STYLES.find(style => style.name === 'body')?.lineHeight.replace(
        'px',
        '',
      ),
    );
    const labelLine = Number(
      TYPE_STYLES.find(style => style.name === 'label')?.lineHeight.replace(
        'px',
        '',
      ),
    );
    expect(token('size-row')).toBeGreaterThan(bodyLine);
    expect(token('size-row-menu')).toBeGreaterThan(bodyLine);
    expect(token('size-control-md')).toBeGreaterThan(bodyLine);
    expect(token('size-control-sm')).toBeGreaterThan(labelLine);
    expect(token('size-row-double')).toBeGreaterThan(
      bodyLine + token('space-2') + labelLine,
    );
    expect(token('size-count')).toBeGreaterThanOrEqual(bodyLine);
    const microLine = Number(
      TYPE_STYLES.find(style => style.name === 'micro')?.lineHeight.replace(
        'px',
        '',
      ),
    );
    expect(token('size-badge')).toBeGreaterThanOrEqual(microLine);
    expect(token('size-row')).toBeGreaterThanOrEqual(
      token('size-badge') + token('space-4') * 2,
    );
  });
});

describe('smart guide design contract', () => {
  it('ships the semantic color and zoom-independent distances in both CSS copies', () => {
    const source: unknown = JSON.parse(
      readFileSync(resolve(PROJECT, 'tokens.json'), 'utf8'),
    );
    expect(source).toHaveProperty(
      'color.tokens',
      expect.arrayContaining([
        expect.objectContaining({name: 'guide', value: '{accent}'}),
      ]),
    );
    expect(source).toHaveProperty(
      'size.tokens',
      expect.arrayContaining([
        expect.objectContaining({name: 'size-guide-line', value: '1px'}),
        expect.objectContaining({name: 'size-guide-snap', value: '6px'}),
      ]),
    );
    for (const css of [designCss, appCss]) {
      expect(css).toContain('--guide: var(--accent);');
      expect(css).toContain('--size-guide-line: 1px;');
      expect(css).toContain('--size-guide-snap: 6px;');
    }
  });
});

describe('slider pointer target', () => {
  it('meets the 22px minimum without growing the painted track or knob', () => {
    for (const css of [designCss, appCss]) {
      expect(css).toContain('--size-slider-hit: 22px;');
      expect(css).toContain('--size-slider-track: 4px;');
      expect(css).toContain('--size-slider-knob: 12px;');
    }
    const reference = readFileSync(
      resolve(REPOSITORY, 'design/system/css/24-slider.css'),
      'utf8',
    );
    expect(reference).toContain('height: var(--size-slider-hit)');
  });
});
