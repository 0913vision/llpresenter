import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

const root = resolve(import.meta.dirname, '../..');

describe('app icon', () => {
  it('packages the icon used by the Windows app and NSIS installer', () => {
    const config = readFileSync(resolve(root, 'electron-builder.yml'), 'utf8');
    for (const field of [
      'icon',
      'installerIcon',
      'uninstallerIcon',
      'installerHeaderIcon',
    ]) {
      expect(config).toContain(`${field}: build/icon.ico`);
    }
    expect(config).toContain('  - build/icon.ico');
    for (const name of ['icon.ico', 'icon.png', 'icon.svg', 'icon-small.svg']) {
      expect(existsSync(resolve(root, 'build', name))).toBe(true);
    }
  });

  it('contains every required Windows icon size', () => {
    const bytes = readFileSync(resolve(root, 'build/icon.ico'));
    expect(bytes.readUInt16LE(0)).toBe(0);
    expect(bytes.readUInt16LE(2)).toBe(1);
    const count = bytes.readUInt16LE(4);
    const sizes = Array.from({length: count}, (_, index) => {
      const offset = 6 + index * 16;
      const width = bytes[offset];
      const height = bytes[offset + 1];
      expect(width).toBe(height);
      return width === 0 ? 256 : width;
    });
    expect(sizes).toEqual(expect.arrayContaining([16, 24, 32, 48, 64, 256]));
  });
});
