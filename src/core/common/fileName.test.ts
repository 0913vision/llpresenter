import {win32} from 'node:path';
import {describe, expect, it} from 'vitest';
import {fileStem} from './fileName';

const NAMES = [
  'Song.txt',
  'Example.song.txt',
  'C:\\data\\Song.txt',
  'C:/data/Song.txt',
  'C:Song.txt',
  '\\\\server\\share\\Song.txt',
  'Song',
  'Song.',
  '.txt',
  '.hidden.txt',
  '..',
  '주일 찬양.txt',
  '',
];

describe('fileStem', () => {
  it.each(NAMES)('names %j as Windows does', name => {
    expect(fileStem(name)).toBe(win32.parse(name).name);
  });
});
