import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const read = (path: string): string => readFileSync(path, 'utf8');
const css = (name: string): string =>
  read(`src/renderer/src/ui/${name}.module.css`);
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
    for (const path of [
      'src/renderer/src/styles/tokens.css',
      'design/system/project/tokens.css',
    ]) {
      const source = read(path);
      const ratio = (text: string, background: string): number =>
        (token(source, text) + 0.05) / (token(source, background) + 0.05);
      expect(ratio('text-3', 'bg-control')).toBeGreaterThanOrEqual(4.5);
      expect(ratio('text-3', 'bg-control-hover')).toBeGreaterThanOrEqual(4.5);
      expect(ratio('text-2', 'selection')).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps the generated colors aligned with their source', () => {
    const source = read('design/system/project/tokens.json');
    const design = read('design/system/project/tokens.css');
    const app = read('src/renderer/src/styles/tokens.css');
    for (const name of [
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
  it('keeps enabled off and selected labels readable while disabled states remain distinct', () => {
    expect(css('ToolbarButton')).toMatch(
      /\.output\[data-state='off'\] \.label,[\s\S]*?color:\s*var\(--text-2\)/,
    );
    expect(css('ToolbarButton')).toMatch(
      /\.button\[aria-disabled='true'\][\s\S]*?color:\s*var\(--text-off\)/,
    );
    expect(css('PreviewFrame')).toMatch(
      /\[data-state='off'\] \.name\s*\{\s*color:\s*var\(--text-3\)/,
    );
    expect(css('ListRow')).toMatch(
      /\.row\[data-state~='done'\]\[aria-selected='true'\]\s*\{\s*color:\s*var\(--text-2\)/,
    );
    const layout = read('src/renderer/src/screens/DisplayLayout.module.css');
    expect(layout).toMatch(/\.number\s*\{\s*color:\s*var\(--text-2\)/);
    expect(layout).toMatch(
      /\.selected \.control\s*\{\s*color:\s*var\(--text-2\)/,
    );
  });
});
