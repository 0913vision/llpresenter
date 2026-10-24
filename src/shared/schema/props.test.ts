import {describe, it} from 'vitest';
import {parseProps, serializeProps} from './props';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseProps, serialize: serializeProps};
const LOGO = 'e1e2e3e4-2222-4222-8333-444455556666';
const COUNTDOWN = 'e1e2e3e4-1111-4222-8333-444455556666';
const LOGO_IMAGE = '8a8b8c8d-1e2f-4a3b-9c4d-5e6f7a8b9c0d';
const START_TIMER = 'b9b8b7b6-2222-4222-8333-444455556666';
const MAIN_SCREEN = '11111111-1111-4111-8111-111111111111';

function textStyle() {
  return {
    font: 'Pretendard',
    weight: 600,
    color: '#FFFFFF',
    size: 64,
    lineHeight: 1.2,
    align: 'center',
    vAlign: 'bottom',
    maxLines: 1,
    margin: 4,
    shadow: true,
    outline: false,
  };
}

function countdown() {
  return {
    id: COUNTDOWN,
    name: '시작 카운트다운',
    content: {
      kind: 'text',
      text: `예배 시작까지 {timer:${START_TIMER}}`,
      style: textStyle(),
    },
    targets: [MAIN_SCREEN],
  };
}

function propsFile(props: readonly object[]) {
  return {format: 'llsettings.props', schemaVersion: 1, props};
}

describe('parseProps', () => {
  it('reads an image 소품 and a text 소품', () => {
    expectRoundTrip(
      codec,
      propsFile([
        {
          id: LOGO,
          name: '로고',
          content: {kind: 'image', media: LOGO_IMAGE},
          targets: [MAIN_SCREEN],
        },
        countdown(),
      ]),
    );
  });

  it('keeps unknown fields in the content and the style', () => {
    const prop = countdown();
    expectRoundTrip(
      codec,
      propsFile([
        {
          ...prop,
          content: {
            ...prop.content,
            style: {...textStyle(), letterSpacing: 0.1},
            animation: 'none',
          },
        },
      ]),
    );
  });

  it.each([
    [
      'an unknown content kind',
      {content: {kind: 'video', media: LOGO_IMAGE}},
      'props.0.content.kind',
    ],
    [
      'an image without media',
      {content: {kind: 'image'}},
      'props.0.content.media',
    ],
    [
      'text without a style',
      {content: {kind: 'text', text: '안내'}},
      'props.0.content.style',
    ],
    [
      'a style without maximum lines',
      {
        content: {
          kind: 'text',
          text: '안내',
          style: {...textStyle(), maxLines: undefined},
        },
      },
      'props.0.content.style.maxLines',
    ],
  ])('rejects a 소품 with %s', (_name, change, field) => {
    expectInvalidField(codec, propsFile([{...countdown(), ...change}]), field);
  });
});
