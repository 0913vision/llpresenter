import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {translationIdSchema} from '@core/schema/ids';
import {passageItem} from '@renderer/features/service/items/quickAddBible';

const translation = v.parse(translationIdSchema, 'krv');

describe('quick add Bible passages', () => {
  it('makes a passage item with the default settings and a new id', () => {
    const first = passageItem('요한복음 3:16', {
      translation,
      verseNumbers: true,
    });
    const second = passageItem('요한복음 3:16', {
      translation,
      verseNumbers: false,
    });
    expect(first).toMatchObject({
      bible: {
        translation,
        ref: '요한복음 3:16',
        split: 'verse',
        reference: 'every',
        verseNumbers: true,
        translationName: false,
      },
    });
    expect(second).toMatchObject({bible: {verseNumbers: false}});
    expect(first.id).not.toBe(second.id);
  });

  it('takes reference and translation settings but ignores legacy packing defaults', () => {
    expect(
      passageItem('요한복음 3:16', {
        translation,
        verseNumbers: true,
        split: 'two',
        reference: 'last',
        translationName: true,
      }),
    ).toMatchObject({
      bible: {split: 'verse', reference: 'last', translationName: true},
    });
  });
});
