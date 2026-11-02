import {describe, expect, it} from 'vitest';
import {copyName} from '@core/common/copyName';

describe('copyName', () => {
  it('adds 복사본 to a name no copy has taken', () => {
    expect(copyName('찬양', ['찬양', '말씀'])).toBe('찬양 복사본');
  });

  it('numbers the copy from 2 on when the name is taken', () => {
    expect(copyName('찬양', ['찬양 복사본'])).toBe('찬양 복사본 2');
    expect(copyName('찬양', ['찬양 복사본', '찬양 복사본 2'])).toBe(
      '찬양 복사본 3',
    );
  });

  it('takes the first free number, not the next after the highest', () => {
    expect(copyName('찬양', ['찬양 복사본', '찬양 복사본 3'])).toBe(
      '찬양 복사본 2',
    );
  });

  it('copies a copy from what stands before its ending', () => {
    expect(copyName('찬양 복사본', ['찬양 복사본'])).toBe('찬양 복사본 2');
    expect(copyName('찬양 복사본 2', ['찬양 복사본', '찬양 복사본 2'])).toBe(
      '찬양 복사본 3',
    );
    expect(copyName('찬양 복사본', [])).toBe('찬양 복사본');
  });

  it('keeps a name that is only the word', () => {
    expect(copyName('복사본', [])).toBe('복사본 복사본');
  });

  it('compares trimmed names by default', () => {
    expect(copyName('  찬양 ', ['찬양 복사본 '])).toBe('찬양 복사본 2');
  });

  it('compares with the owner’s own normalization', () => {
    const nfc = (name: string): string => name.trim().normalize('NFC');
    expect(
      copyName('새 아침', ['새 아침 복사본'.normalize('NFD')], {
        normalize: nfc,
      }),
    ).toBe('새 아침 복사본 2');
  });

  it('cuts the original to fit the longest name', () => {
    const name = '가'.repeat(10);
    const copy = copyName(name, [], {maxLength: 8});

    expect(copy).toBe('가가가가 복사본');
    expect(copy).toHaveLength(8);
    expect(copyName(name, [copy], {maxLength: 8})).toBe('가가 복사본 2');
  });
});
