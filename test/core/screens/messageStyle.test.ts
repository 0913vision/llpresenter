import {expect, it} from 'vitest';
import {createMessageStyleId} from '@core/schema/ids';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/messages';
import {resolveMessageStyle} from '@core/screens/messageStyle';

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
