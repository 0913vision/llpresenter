import {expect, it} from 'vitest';
import {createMessageStyleId} from '@core/schema/ids';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/messages';
import {
  MESSAGE_BAND,
  messageBandFor,
  resolveMessageStyle,
} from '@core/screens/messageStyle';
import {isChromaKeyColor, isKeyBackground} from '@core/screens/emptyColor';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';

const BIG = {
  ...DEFAULT_MESSAGE_STYLE,
  id: createMessageStyleId('00000000-0000-4000-8000-000000000002'),
  name: '큰 글씨',
  size: 120,
};

it('finds the style by id', () => {
  expect(resolveMessageStyle([BIG], BIG.id)).toBe(BIG);
});

it.each([
  ['no id', undefined, [BIG]],
  ['an unknown id', '99999999-9999-4999-8999-999999999999', [BIG]],
  ['no saved styles', BIG.id, undefined],
])('falls back to 기본 for %s', (_name, id, styles) => {
  expect(resolveMessageStyle(styles, id)).toBe(DEFAULT_MESSAGE_STYLE);
});

it('makes the built-in 기본 style a top band, not the lyric style', () => {
  expect(DEFAULT_MESSAGE_STYLE).toMatchObject({
    weight: 600,
    size: 54,
    color: '#FFFFFF',
    align: 'center',
    vAlign: 'top',
    maxLines: 2,
    margin: 0,
    background: {color: '#000000', opacity: 72},
  });
  expect(DEFAULT_MESSAGE_STYLE.size).toBeLessThan(DEFAULT_TEXT_STYLE.size);
  expect(DEFAULT_MESSAGE_STYLE.weight).not.toBe(DEFAULT_TEXT_STYLE.weight);
});

it('sizes the band as 5% of the height with 1.6% and 4% padding', () => {
  expect(MESSAGE_BAND.size).toBe(1080 * 0.05);
  expect(MESSAGE_BAND.paddingY).toBeCloseTo(1080 * 0.016, 2);
  expect(MESSAGE_BAND.paddingX).toBeCloseTo(1920 * 0.04, 2);
  expect(MESSAGE_BAND.maxLines).toBe(2);
  expect(MESSAGE_BAND.background).toEqual({color: '#000000', opacity: 72});
});

it('is a band only for the built-in style; a saved style draws as it did', () => {
  expect(messageBandFor(DEFAULT_MESSAGE_STYLE)).toBe(MESSAGE_BAND);
  expect(messageBandFor(BIG)).toBeUndefined();
});

it('draws the band opaque black over the chroma key green only', () => {
  expect(messageBandFor(DEFAULT_MESSAGE_STYLE, true)?.background).toEqual({
    color: '#000000',
    opacity: 100,
  });
  expect(messageBandFor(DEFAULT_MESSAGE_STYLE, false)?.background.opacity).toBe(
    72,
  );
  expect(messageBandFor(BIG, true)).toBeUndefined();
  expect(isChromaKeyColor('#00b140')).toBe(true);
  expect(isChromaKeyColor('#000000')).toBe(false);
  expect(isChromaKeyColor(undefined)).toBe(false);
});

it('knows the key color: the chroma green anywhere, the own empty color on a 캡처용 창', () => {
  expect(isKeyBackground('#00B140', {})).toBe(true);
  expect(
    isKeyBackground('#FF00FF', {method: 'capture', emptyColor: '#ff00ff'}),
  ).toBe(true);
  expect(
    isKeyBackground('#FF00FF', {method: 'window', emptyColor: '#FF00FF'}),
  ).toBe(false);
  expect(
    isKeyBackground('#112233', {method: 'capture', emptyColor: '#FF00FF'}),
  ).toBe(false);
  expect(isKeyBackground('#00B140', {method: 'capture'})).toBe(true);
  expect(isKeyBackground(undefined, {method: 'capture'})).toBe(false);
});
