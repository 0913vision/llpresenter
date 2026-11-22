import {act, fireEvent, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {MEDIA_DRAG_MIME} from '@renderer/features/media/mediaDrag';
import {useMedia} from '@renderer/platform/media';
import {fixtureMedia, itemMedia} from '@fixtures/core/mediaList';
import {lyricsSlide, slideId, slideOf} from '@fixtures/core/slides';
import {renderEditor, textsOf} from '@fixtures/renderer/features/slides/editor';

let clipboard = '';

beforeEach(() => {
  clipboard = '';
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        clipboard = text;
        return Promise.resolve();
      },
      readText: () => Promise.resolve(clipboard),
    },
  });
});

const song = () => [
  slideOf(1, 'songTitle', {texts: {제목: '새 노래'}}),
  lyricsSlide(2, '새 아침을 노래해요\n함께 걸어요'),
  lyricsSlide(3, '빛을 따라가요'),
];

function surface(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[data-slide-surface]');
  if (found === null) throw new Error('Missing slides');
  return found;
}

function row(index: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-song-slide][data-slide-index="${index}"]`,
  );
  if (found === null) throw new Error(`Missing slide ${index}`);
  return found;
}

function field(index: number, name: string): HTMLTextAreaElement {
  const found = within(row(index)).getByRole('textbox', {name});
  if (!(found instanceof HTMLTextAreaElement)) throw new Error('Not a field');
  return found;
}

function inspector() {
  return within(screen.getByRole('region', {name: '슬라이드 속성'}));
}

const selected = () =>
  [...document.querySelectorAll('[data-song-slide][aria-selected="true"]')].map(
    node => Number(node.getAttribute('data-slide-index')),
  );

function caretAt(input: HTMLTextAreaElement, at: number): void {
  act(() => {
    input.focus();
    input.setSelectionRange(at, at);
  });
}

function key(name: string, more: object = {}): void {
  fireEvent.keyDown(surface(), {key: name, ...more});
}

it('has a field for each box of the theme that has a column', () => {
  renderEditor(song());
  expect(within(row(0)).getAllByRole('textbox')).toHaveLength(2);
  expect(field(0, '제목').value).toBe('새 노래');
  expect(field(1, '가사').value).toBe('새 아침을 노래해요\n함께 걸어요');
});

it('writes what is typed into the slide', async () => {
  const {current} = renderEditor(song());
  await userEvent.type(field(2, '가사'), ' 함께');
  expect(current.slides[2]?.texts).toEqual({가사: '빛을 따라가요 함께'});
});

it('keeps the first text of an empty box out of the file', async () => {
  const {current} = renderEditor(song());
  await userEvent.clear(field(2, '가사'));
  expect(current.slides[2]?.texts).toEqual({});
});

it('joins a slide to the one before with Backspace at its start', () => {
  const {current} = renderEditor(song());
  const input = field(2, '가사');
  caretAt(input, 0);
  fireEvent.keyDown(input, {key: 'Backspace'});
  expect(textsOf(current.slides)).toEqual([
    '새 노래',
    '새 아침을 노래해요\n함께 걸어요\n빛을 따라가요',
  ]);
});

it('does not join lyrics to a title', () => {
  const {current} = renderEditor(song());
  const input = field(1, '가사');
  caretAt(input, 0);
  fireEvent.keyDown(input, {key: 'Backspace'});
  expect(current.slides).toHaveLength(3);
});

it('starts a slide at every blank row of a pasted text', () => {
  const {current} = renderEditor(song());
  const input = field(2, '가사');
  caretAt(input, input.value.length);
  fireEvent.paste(input, {
    clipboardData: {getData: () => '\n첫째 줄\n\n둘째 줄\r\n셋째 줄'},
  });
  expect(textsOf(current.slides).slice(2)).toEqual([
    '빛을 따라가요\n첫째 줄',
    '둘째 줄\n셋째 줄',
  ]);
  expect(current.slides[3]?.theme).toBe(BUILT_IN_THEME_IDS.lyrics);
});

it('goes on in the next slide from the last row of one', () => {
  renderEditor(song());
  const input = field(1, '가사');
  caretAt(input, input.value.length);
  fireEvent.keyDown(input, {key: 'ArrowDown'});
  expect(document.activeElement).toBe(field(2, '가사'));
});

it('selects with click, Shift, Ctrl, and the arrows', async () => {
  renderEditor(song());
  expect(selected()).toEqual([0]);
  const user = userEvent.setup();
  await user.click(row(1));
  expect(selected()).toEqual([1]);
  await user.keyboard('{Shift>}');
  await user.click(row(2));
  await user.keyboard('{/Shift}');
  expect(selected()).toEqual([1, 2]);
  await user.keyboard('{Control>}');
  await user.click(row(1));
  await user.keyboard('{/Control}');
  expect(selected()).toEqual([2]);
  await user.click(row(2));
  act(() => surface().focus());
  key('ArrowUp');
  expect(selected()).toEqual([1]);
});

it('leaves a text with Esc and then the editor', () => {
  const onBack = vi.fn();
  renderEditor(song(), {onBack});
  const input = field(1, '가사');
  caretAt(input, 0);
  fireEvent.keyDown(input, {key: 'Escape'});
  expect(document.activeElement).toBe(surface());
  expect(selected()).toEqual([1]);
  expect(onBack).not.toHaveBeenCalled();
  key('Escape');
  expect(onBack).toHaveBeenCalledOnce();
});

it('drops a range of slides to one before Esc leaves the editor', () => {
  const onBack = vi.fn();
  renderEditor(song(), {onBack});
  act(() => surface().focus());
  key('ArrowDown', {shiftKey: true});
  expect(selected()).toEqual([0, 1]);
  key('Escape');
  expect(selected()).toEqual([1]);
  expect(onBack).not.toHaveBeenCalled();
});

it('copies slides whole and pastes them with new ids and no hot key', async () => {
  const slides = [
    ...song(),
    lyricsSlide(4, '가', {hotKey: 'KeyQ', label: '후렴'}),
  ];
  const {current} = renderEditor(slides);
  const user = userEvent.setup();
  await user.click(row(3));
  act(() => surface().focus());
  await user.keyboard('{Control>}c{/Control}');
  await user.keyboard('{Control>}v{/Control}');
  await act(async () => {
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(current.slides).toHaveLength(5));
  const copy = current.slides[4];
  expect(copy).toMatchObject({texts: {가사: '가'}, label: '후렴'});
  expect(copy?.id).not.toBe(slideId(4));
  expect(copy?.hotKey).toBeUndefined();
  expect(selected()).toEqual([4]);
});

it('makes slides of a text copied in another program', async () => {
  const {current} = renderEditor(song());
  clipboard = '첫 장\n둘째 줄\n\n다음 장';
  await userEvent.click(row(2));
  act(() => surface().focus());
  await userEvent.keyboard('{Control>}v{/Control}');
  await vi.waitFor(() =>
    expect(textsOf(current.slides).slice(3)).toEqual([
      '첫 장\n둘째 줄',
      '다음 장',
    ]),
  );
});

it('duplicates, deletes, and undoes the selection', async () => {
  const {current} = renderEditor(song());
  const user = userEvent.setup();
  await user.click(row(1));
  act(() => surface().focus());
  await user.keyboard('{Control>}d{/Control}');
  expect(textsOf(current.slides)[2]).toBe('새 아침을 노래해요\n함께 걸어요');
  await user.keyboard('{Delete}');
  expect(current.slides).toHaveLength(3);
  expect(selected()).toEqual([2]);
  await user.keyboard('{Control>}z{/Control}');
  await user.keyboard('{Control>}z{/Control}');
  expect(current.slides).toEqual(song());
});

it('adds a slide in the theme that follows the one before', async () => {
  const {current} = renderEditor(song());
  await userEvent.click(row(0));
  await userEvent.click(screen.getByRole('button', {name: '슬라이드 추가'}));
  expect(current.slides[1]?.theme).toBe(BUILT_IN_THEME_IDS.lyrics);
  expect(selected()).toEqual([1]);
});

it('shows pictures alone in the grid', () => {
  renderEditor(song(), {grid: true});
  expect(within(surface()).queryAllByRole('textbox')).toEqual([]);
  expect(document.querySelectorAll('[data-song-slide]')).toHaveLength(3);
});

it('changes nothing in a file of a newer version', async () => {
  const {current} = renderEditor(song(), {readOnly: true});
  await userEvent.type(field(2, '가사'), '!');
  act(() => surface().focus());
  await userEvent.keyboard('{Delete}{Control>}d{/Control}');
  expect(current.slides).toEqual(song());
  expect(
    screen
      .getByRole('button', {name: '슬라이드 추가'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
});

it('switches the columns of a theme on and off', async () => {
  renderEditor(song());
  expect(within(row(1)).queryByRole('textbox', {name: '다음 글'})).toBeNull();
  await userEvent.click(screen.getByRole('button', {name: '열'}));
  const boxes = screen.getAllByRole('menuitemcheckbox', {name: '다음 글'});
  const lyrics = boxes.at(-1);
  if (lyrics === undefined) throw new Error('Missing column');
  await userEvent.click(lyrics);
  expect(field(1, '다음 글').placeholder).toBe(
    '새 아침을 노래해요\n함께 걸어요',
  );
  await userEvent.click(lyrics);
  expect(within(row(1)).queryByRole('textbox', {name: '다음 글'})).toBeNull();
});

it('keeps a next text of its own until it is cleared', async () => {
  const {current} = renderEditor(song());
  await userEvent.click(row(2));
  const next = inspector().getByRole('textbox', {name: '다음 글'});
  expect(next.getAttribute('placeholder')).toBe('빛을 따라가요');
  await userEvent.type(next, '후렴으로');
  expect(current.slides[2]?.next).toBe('후렴으로');
  await userEvent.clear(next);
  expect(current.slides[2]?.next).toBeUndefined();
});

it('sets the theme of every selected slide', async () => {
  const {current} = renderEditor(song());
  await userEvent.click(row(1));
  await userEvent.keyboard('{Shift>}');
  fireEvent.click(row(2), {shiftKey: true});
  await userEvent.keyboard('{/Shift}');
  await userEvent.click(inspector().getByRole('button', {name: '테마'}));
  await userEvent.click(
    screen.getByRole('menuitemradio', {name: '찬양 가사 (밝은 배경)'}),
  );
  const [title, first, second] = current.slides;
  expect(title?.theme).toBe(BUILT_IN_THEME_IDS.songTitle);
  expect(first?.theme).toBe(second?.theme);
  expect(first?.theme).not.toBe(BUILT_IN_THEME_IDS.lyrics);
});

it('gives every slide the transition of the selected one', async () => {
  const slides = song().map((slide, index) =>
    index === 1
      ? {...slide, transition: {kind: 'dissolve' as const, sec: 2}}
      : slide,
  );
  const {current} = renderEditor(slides);
  await userEvent.click(row(1));
  const [, apply] = inspector().getAllByRole('button', {
    name: '전체 슬라이드에 적용',
  });
  if (apply === undefined) throw new Error('Missing button');
  await userEvent.click(apply);
  expect(current.slides.map(slide => slide.transition)).toEqual(
    slides.map(() => ({kind: 'dissolve', sec: 2})),
  );
});

it('moves from a field beside the slides to them with Esc', async () => {
  renderEditor(song());
  await userEvent.click(inspector().getByRole('textbox', {name: '제목'}));
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement).toBe(surface());
});

describe('the background of a slide', () => {
  const {warm, dawn, hymn} = fixtureMedia;

  beforeEach(() => {
    const document = itemMedia();
    useMedia.setState({
      document,
      items: document.value.items,
      missing: new Set(),
    });
  });

  function drop(index: number, id: string) {
    fireEvent.drop(row(index), {
      dataTransfer: {types: [MEDIA_DRAG_MIME], getData: () => id},
    });
  }

  it('is a media file dropped on it', () => {
    const {current} = renderEditor(song());
    drop(1, warm);
    expect(current.slides.map(slide => slide.background)).toEqual([
      undefined,
      {kind: 'media', media: warm},
      undefined,
    ]);
  });

  it('is the dropped file for the whole selection, when one of it is meant', () => {
    const {current} = renderEditor(song());
    act(() => surface().focus());
    key('ArrowDown', {shiftKey: true});
    drop(1, dawn);
    expect(current.slides.map(slide => slide.background?.kind)).toEqual([
      'media',
      'media',
      undefined,
    ]);
  });

  it('is no audio, and no file that is gone', () => {
    const report = vi.fn();
    const {current} = renderEditor(song(), {report});
    drop(1, hymn);
    useMedia.setState({missing: new Set([warm])});
    drop(1, warm);
    expect(report).toHaveBeenCalledTimes(2);
    expect(current.slides).toEqual(song());
  });

  it('is chosen at the right, and taken away again', async () => {
    const {current} = renderEditor(song());
    const choose = async (name: string) => {
      await userEvent.click(inspector().getByRole('button', {name: '배경'}));
      fireEvent.change(screen.getByRole('combobox'), {target: {value: name}});
      fireEvent.click(screen.getByRole('option', {name}));
    };
    await choose('따뜻한 빛');
    expect(current.slides[0]?.background).toEqual({kind: 'media', media: warm});
    expect(inspector().getByRole('button', {name: '맞춤'})).toBeTruthy();
    await choose('없음');
    expect(current.slides[0]?.background).toEqual({kind: 'none'});
    await choose('테마 배경');
    expect(current.slides[0]?.background).toBeUndefined();
  });

  it('is given to every slide', async () => {
    const {current} = renderEditor(
      song().map((slide, index) =>
        index === 0
          ? {...slide, background: {kind: 'media' as const, media: warm}}
          : slide,
      ),
    );
    const [apply] = inspector().getAllByRole('button', {
      name: '전체 슬라이드에 적용',
    });
    if (apply === undefined) throw new Error('Missing button');
    await userEvent.click(apply);
    expect(
      current.slides.every(slide => slide.background?.kind === 'media'),
    ).toBe(true);
  });
});
