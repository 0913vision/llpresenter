import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {paletteHex} from '@core/labels/colors';
import {STAGE_COLORS} from '@core/themes/stageColors';
import {labelInk} from '@renderer/ui/labelInk';

const read = (path: string): string => readFileSync(path, 'utf8');
const TOKEN_CSS_PATHS = [
  'src/renderer/src/styles/tokens.css',
  'design/system/project/tokens.css',
];
function luminance(hex: string): number {
  const rgb = [0, 2, 4]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return (
    0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0)
  );
}
function token(source: string, name: string): number {
  const hex = new RegExp(`--${name}: #([0-9a-f]{6})`).exec(source)?.[1];
  if (!hex) throw new Error(`Missing token: ${name}`);
  return luminance(hex);
}

describe('readable control text', () => {
  it('keeps the design and app token contrast at least 4.5 on control and selected backgrounds', () => {
    for (const path of TOKEN_CSS_PATHS) {
      const source = read(path);
      const ratio = (text: string, background: string): number =>
        (token(source, text) + 0.05) / (token(source, background) + 0.05);
      expect(ratio('text-3', 'bg-control')).toBeGreaterThanOrEqual(4.5);
      expect(ratio('text-3', 'bg-control-hover')).toBeGreaterThanOrEqual(4.5);
      expect(ratio('text-2', 'selection')).toBeGreaterThanOrEqual(4.5);
    }
  });
  it.each(TOKEN_CSS_PATHS)(
    'keeps white text at least 4.5:1 on both primary fills in %s',
    path => {
      const source = read(path);
      for (const name of ['accent-fill', 'accent-fill-hover']) {
        const ratio =
          (token(source, 'text-on-fill') + 0.05) / (token(source, name) + 0.05);
        expect(ratio, name).toBeGreaterThanOrEqual(4.5);
      }
      expect(token(source, 'accent-fill-hover')).toBeLessThan(
        token(source, 'accent-fill'),
      );
    },
  );
  it('keeps the generated colors aligned with their source', () => {
    const source = read('design/system/project/tokens.json');
    const design = read('design/system/project/tokens.css');
    const app = read('src/renderer/src/styles/tokens.css');
    for (const name of [
      'stage-bar',
      'stage-next',
      'text-3',
      'text-2',
      'bg-control',
      'bg-control-hover',
      'selection',
    ]) {
      const value = new RegExp(
        `"name": "${name}",\\s*"value": "(#[0-9a-f]{6})"`,
      ).exec(source)?.[1];
      if (value === undefined) throw new Error(`Missing source token: ${name}`);
      expect(design).toContain(`--${name}: ${value};`);
      expect(app).toContain(`--${name}: ${value};`);
    }
  });
});

describe('thumbnail label contrast', () => {
  it.each(TOKEN_CSS_PATHS)('keeps every palette color readable in %s', path => {
    const source = read(path);
    for (const color of Object.values(paletteHex)) {
      const ink =
        labelInk(color)['--label-ink'] === 'var(--text-on-label)'
          ? token(source, 'text-on-label')
          : token(source, 'text-on-fill');
      const fill = luminance(color.slice(1));
      const ratio = (Math.max(ink, fill) + 0.05) / (Math.min(ink, fill) + 0.05);
      expect(ratio, color).toBeGreaterThanOrEqual(4.5);
    }
    const neutral =
      (token(source, 'label-gray') + 0.05) /
      (token(source, 'bg-control') + 0.05);
    expect(neutral).toBeGreaterThanOrEqual(4.5);
  });
});

it('keeps the saved stage output colors aligned with the design tokens', () => {
  const source = read('design/system/project/tokens.json');
  for (const [name, color] of [
    ['stage-bar', STAGE_COLORS.bar],
    ['stage-next', STAGE_COLORS.next],
    ['text-2', STAGE_COLORS.muted],
  ] as const) {
    const value = new RegExp(
      `"name": "${name}",\\s*"value": "(#[0-9a-f]{6})"`,
    ).exec(source)?.[1];
    expect(value).toBe(color.toLowerCase());
  }
});
