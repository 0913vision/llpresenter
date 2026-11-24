import {expect, it} from 'vitest';
import {fixedKeyText} from '@renderer/ui/keys/fixedKeys';

it('names the fixed editing keys as menus show them', () => {
  expect(fixedKeyText('copy')).toBe('Ctrl C');
  expect(fixedKeyText('cut')).toBe('Ctrl X');
  expect(fixedKeyText('paste')).toBe('Ctrl V');
  expect(fixedKeyText('selectAll')).toBe('Ctrl A');
});
