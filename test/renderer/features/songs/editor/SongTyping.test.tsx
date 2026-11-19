import {act, fireEvent} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {
  editorSetup,
  lyrics,
} from '@fixtures/renderer/features/songs/editor/editorTesting';

vi.mock(
  '@renderer/rendering/pictures/Picture',
  () => import('@fixtures/renderer/picture'),
);
vi.mock('@renderer/rendering/pictures/pictureService', () => ({
  pictures: {
    inputs: () => '',
    subscribeInputs: () => () => undefined,
    request: () => ({
      available: true,
      done: false,
      subscribe: () => () => undefined,
    }),
  },
}));

function replaceSelection(
  input: HTMLTextAreaElement,
  data: string,
  composing = false,
): void {
  const inputType = composing ? 'insertCompositionText' : 'insertText';
  fireEvent(
    input,
    new InputEvent('beforeinput', {bubbles: true, data, inputType}),
  );
  const {value, selectionStart, selectionEnd} = input;
  const caret = selectionStart + data.length;
  fireEvent.input(input, {
    data,
    inputType,
    isComposing: composing,
    target: {
      value: value.slice(0, selectionStart) + data + value.slice(selectionEnd),
      selectionStart: caret,
      selectionEnd: caret,
    },
  });
}

it('keeps a zero-delay lyric burst and its caret in order while the picture is pending', async () => {
  const {session} = await editorSetup();
  const input = lyrics(2);
  act(() => input.focus());
  input.select();
  let expected = '';
  for (const character of '주님 앞에 이 몸을 맡길 때') {
    replaceSelection(input, character);
    expected += character;
    expect(input.value).toBe(expected);
    expect([input.selectionStart, input.selectionEnd]).toEqual([
      expected.length,
      expected.length,
    ]);
  }
  expect(session.history.snapshot.song.slides[1]?.lines).toEqual([expected]);
});

it('keeps the Korean IME replacement range and accepts the next character', async () => {
  const {session} = await editorSetup();
  const input = lyrics(2);
  act(() => input.focus());
  input.select();
  replaceSelection(input, '앞 ');
  fireEvent.compositionStart(input);
  for (const syllable of ['ㅎ', '하', '한']) {
    input.setSelectionRange(2, input.value.length);
    fireEvent.compositionUpdate(input, {data: syllable});
    replaceSelection(input, syllable, true);
    expect(input.value).toBe(`앞 ${syllable}`);
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 3]);
  }
  fireEvent.compositionEnd(input, {data: '한'});
  replaceSelection(input, '글');
  expect(input.value).toBe('앞 한글');
  expect([input.selectionStart, input.selectionEnd]).toEqual([4, 4]);
  expect(session.history.snapshot.song.slides[1]?.lines).toEqual(['앞 한글']);
});
