import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {defaultTranslationOf, showsTranslationName} from '@core/bible';
import type {Translation} from '@core/schema/bible/bible';
import {LIVE_BIBLE_ID, translationIdSchema} from '@core/schema/common/ids';

function id(value: string) {
  return v.parse(translationIdSchema, value);
}
function translation(value: string, isDefault = false): Translation {
  return {
    id: id(value),
    name: value,
    lang: 'ko',
    file: `${value}.llbible`,
    default: isDefault,
  };
}

describe('the 기본 역본', () => {
  it('is the translation marked 기본, else the first one, else none', () => {
    expect(
      defaultTranslationOf([translation('krv'), translation('gae', true)]),
    ).toBe('gae');
    expect(defaultTranslationOf([translation('krv'), translation('kjv')])).toBe(
      'krv',
    );
    expect(defaultTranslationOf([])).toBeUndefined();
  });
});

describe('the translation name of a new passage', () => {
  const church = [
    translation('krv'),
    translation('kjv'),
    {...translation('gae', true), name: '개역개정'},
  ];

  it('shows for every translation but the 기본 역본', () => {
    expect(showsTranslationName(id('kjv'), church)).toBe(true);
    expect(showsTranslationName(id('krv'), church)).toBe(true);
    expect(showsTranslationName(id('gae'), church)).toBe(false);
  });

  it('counts the live 개역개정 as the 기본 역본 when that is 개역개정', () => {
    expect(showsTranslationName(LIVE_BIBLE_ID, church)).toBe(false);
    expect(
      showsTranslationName(LIVE_BIBLE_ID, [
        {...translation('krv', true), name: '개역한글'},
      ]),
    ).toBe(true);
  });

  it('stays hidden while no 기본 역본 is known', () => {
    expect(showsTranslationName(id('kjv'), [])).toBe(false);
  });
});
