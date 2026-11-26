import {act, fireEvent, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {BUILT_IN_THEME_IDS, SONG_THEME_IDS} from '@core/theme/builtIn/ids';
import {MEDIA_DRAG_MIME} from '@renderer/features/media/mediaDrag';
import {useMedia} from '@renderer/platform/documents/media';
import {fixtureMedia, itemMedia} from '@fixtures/core/mediaList';
import {lyricsSlide, slideId, slideOf, verseOf} from '@fixtures/core/slides';
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

function song() {
  return [
    slideOf(1, 'songTitle', {texts: {제목: '새 노래'}}),
    lyricsSlide(2, '새 아침을 노래해요\n함께 걸어요'),
    lyricsSlide(3, '빛을 따라가요'),
  ];
}

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

async function openTab(name: string): Promise<void> {
  await userEvent.click(inspector().getByRole('tab', {name}));
}

function selected() {
  return [
    ...document.querySelectorAll('[data-song-slide][aria-selected="true"]'),
  ].map(node => Number(node.getAttribute('data-slide-index')));
}

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

it('never joins a slide to the one before with Backspace at its start', () => {
  const {current} = renderEditor(song());
  for (const index of [1, 2]) {
    const input = field(index, '가사');
    caretAt(input, 0);
    fireEvent.keyDown(input, {key: 'Backspace'});
  }
  expect(current.slides).toHaveLength(3);
});

it('takes a pasted text with blank rows into the same slide', () => {
  const {current} = renderEditor(song());
  const input = field(2, '가사');
  caretAt(input, input.value.length);
  fireEvent.paste(input, {
    clipboardData: {getData: () => '\n첫째 줄\n\n둘째 줄'},
  });
  expect(current.slides).toHaveLength(3);
});

it('does not split a slide with Ctrl Enter', async () => {
  const {current} = renderEditor(song());
  const input = field(2, '가사');
  caretAt(input, 2);
  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  expect(current.slides).toHaveLength(3);
});

it('keeps the caret in its text at the first and last row', () => {
  renderEditor(song());
  const input = field(1, '가사');
  caretAt(input, input.value.length);
  fireEvent.keyDown(input, {key: 'ArrowDown'});
  expect(document.activeElement).toBe(input);
  caretAt(input, 0);
  fireEvent.keyDown(input, {key: 'ArrowUp'});
  expect(document.activeElement).toBe(input);
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

it('cuts the chosen slides to paste them elsewhere, and selects all', async () => {
  const {current} = renderEditor(song());
  const user = userEvent.setup();
  await user.click(row(2));
  act(() => surface().focus());
  await user.keyboard('{Control>}x{/Control}');
  expect(textsOf(current.slides)).not.toContain('빛을 따라가요');
  expect(current.slides).toHaveLength(2);
  await user.click(row(0));
  act(() => surface().focus());
  await user.keyboard('{Control>}v{/Control}');
  await vi.waitFor(() =>
    expect(textsOf(current.slides)[1]).toBe('빛을 따라가요'),
  );
  await user.keyboard('{Control>}a{/Control}');
  expect(selected()).toEqual([0, 1, 2]);
});

it('deletes several chosen slides at once, as one step that 실행 취소 brings back', async () => {
  const {current} = renderEditor(song());
  const user = userEvent.setup();
  await user.click(row(1));
  await user.keyboard('{Shift>}');
  fireEvent.click(row(2), {shiftKey: true});
  await user.keyboard('{/Shift}');
  act(() => surface().focus());
  await user.keyboard('{Delete}');
  expect(current.slides).toHaveLength(1);
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
  expect(
    within(row(1)).queryByRole('textbox', {name: '미리 보여줄 내용'}),
  ).toBeNull();
  await userEvent.click(screen.getByRole('button', {name: '열'}));
  const boxes = screen.getAllByRole('menuitemcheckbox', {
    name: '미리 보여줄 내용',
  });
  const lyrics = boxes.at(-1);
  if (lyrics === undefined) throw new Error('Missing column');
  await userEvent.click(lyrics);
  expect(field(1, '미리 보여줄 내용').placeholder).toBe(
    '새 아침을 노래해요\n함께 걸어요',
  );
  await userEvent.click(lyrics);
  expect(
    within(row(1)).queryByRole('textbox', {name: '미리 보여줄 내용'}),
  ).toBeNull();
});

describe('what fills itself', () => {
  const next = () => {
    const found = inspector().getByRole('textbox', {name: '미리 보여줄 내용'});
    if (!(found instanceof HTMLTextAreaElement)) throw new Error('No field');
    return found;
  };
  const edit = () =>
    within(inspector().getByRole('group', {name: '부가 정보'})).getByRole(
      'button',
    );

  it('is locked until it is opened for editing', async () => {
    const {current} = renderEditor(song());
    await userEvent.click(row(2));
    await openTab('내용');
    expect(next().placeholder).toBe('빛을 따라가요');
    expect(next().readOnly).toBe(true);
    await userEvent.type(next(), '후렴으로');
    expect(current.slides[2]?.next).toBeUndefined();
  });

  it('starts from its default, and goes back to it when it is locked', async () => {
    const {current} = renderEditor(song());
    await userEvent.click(row(2));
    await openTab('내용');
    expect(edit().textContent).toBe('편집');
    await userEvent.click(edit());
    expect(next().value).toBe('빛을 따라가요');
    await userEvent.type(next(), ' 다시');
    expect(current.slides[2]?.next).toBe('빛을 따라가요 다시');
    expect(edit().textContent).toBe('기본값으로');
    await userEvent.click(edit());
    expect(current.slides[2]?.next).toBeUndefined();
    expect(next().readOnly).toBe(true);
  });

  it('stays open for editing while its text is emptied', async () => {
    const {current} = renderEditor(song());
    await userEvent.click(row(2));
    await openTab('내용');
    await userEvent.click(edit());
    await userEvent.clear(next());
    expect(current.slides[2]?.next).toBeUndefined();
    await userEvent.type(next(), '후렴으로');
    expect(current.slides[2]?.next).toBe('후렴으로');
    fireEvent.click(row(1));
    expect(next().readOnly).toBe(true);
  });

  it('breaks its line with Enter and keeps the lines it is given', async () => {
    const {current} = renderEditor(song());
    await userEvent.click(row(2));
    await openTab('내용');
    await userEvent.click(edit());
    await userEvent.clear(next());
    await userEvent.type(next(), '후렴으로{Enter}다시');
    expect(current.slides[2]?.next).toBe('후렴으로\n다시');
    expect(document.activeElement).toBe(next());
  });

  it('is only shown for one slide', async () => {
    renderEditor(song());
    await userEvent.click(row(1));
    await openTab('내용');
    fireEvent.click(row(2), {shiftKey: true});
    expect(
      inspector().queryByRole('textbox', {name: '미리 보여줄 내용'}),
    ).toBeNull();
    expect(inspector().getByRole('button', {name: '이름표'})).toBeTruthy();
  });
});

it('sets the theme of every selected slide', async () => {
  const {current} = renderEditor(song());
  await userEvent.click(row(1));
  await userEvent.keyboard('{Shift>}');
  fireEvent.click(row(2), {shiftKey: true});
  await userEvent.keyboard('{/Shift}');
  await openTab('디자인');
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
  await openTab('전환');
  await userEvent.click(
    inspector().getByRole('button', {name: '전체 슬라이드에 적용'}),
  );
  expect(current.slides.map(slide => slide.transition)).toEqual(
    slides.map(() => ({kind: 'dissolve', sec: 2})),
  );
});

describe('the transition of a slide', () => {
  it('takes an effect with its direction, and a direction only for a moving one', async () => {
    const {current} = renderEditor(song());
    await userEvent.click(row(1));
    await openTab('전환');
    await userEvent.click(inspector().getByRole('button', {name: /디졸브/u}));
    expect(current.slides[1]?.transition).toEqual({kind: 'dissolve', sec: 0.5});
    expect(
      inspector().getByRole('button', {name: '오른쪽으로'}),
    ).toHaveProperty('disabled', true);
    await userEvent.click(inspector().getByRole('button', {name: /밀어내기/u}));
    await userEvent.click(
      inspector().getByRole('button', {name: '오른쪽으로'}),
    );
    expect(current.slides[1]?.transition).toEqual({
      kind: 'push',
      sec: 0.5,
      dir: 'right',
    });
  });

  it('takes a typed time to a hundredth, within 0.1 to 10 seconds, and nothing that is not a number', async () => {
    const slides = song().map((slide, index) =>
      index === 1
        ? {...slide, transition: {kind: 'dissolve' as const, sec: 1}}
        : slide,
    );
    const {current} = renderEditor(slides);
    await userEvent.click(row(1));
    await openTab('전환');
    const time = inspector().getByRole('textbox', {name: '전환 시간'});
    const type = async (text: string): Promise<void> => {
      await userEvent.clear(time);
      await userEvent.type(time, `${text}{Enter}`);
    };
    await type('3.456');
    expect(current.slides[1]?.transition?.sec).toBe(3.46);
    await type('25');
    expect(current.slides[1]?.transition?.sec).toBe(10);
    await type('0');
    expect(current.slides[1]?.transition?.sec).toBe(0.1);
    await type('빠르게');
    expect(current.slides[1]?.transition?.sec).toBe(0.1);
  });

  it('shows the transitions of slides that differ as mixed, with no direction to pick', async () => {
    const slides = song().map((slide, index) =>
      index === 1
        ? {...slide, transition: {kind: 'dissolve' as const, sec: 1}}
        : index === 2
          ? {
              ...slide,
              transition: {kind: 'push' as const, sec: 1, dir: 'up' as const},
            }
          : slide,
    );
    renderEditor(slides);
    await userEvent.click(row(1));
    await userEvent.keyboard('{Shift>}');
    fireEvent.click(row(2), {shiftKey: true});
    await userEvent.keyboard('{/Shift}');
    await openTab('전환');
    const time = inspector().getByRole('textbox', {name: '전환 시간'});
    expect(time.getAttribute('placeholder')).toBe('혼합');
    expect(inspector().getByRole('button', {name: '위로'})).toHaveProperty(
      'disabled',
      true,
    );
  });
});

it('moves from a field beside the slides to them with Esc', async () => {
  renderEditor(song());
  await openTab('내용');
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

  it('keeps drawing a slide whose background file is missing, marked with the path', () => {
    const slides = song().map((slide, index) =>
      index === 1
        ? {...slide, background: {kind: 'media' as const, media: warm}}
        : slide,
    );
    useMedia.setState({missing: new Set([warm])});
    renderEditor(slides);
    const marked = row(1).querySelector('[title^="파일을 찾을 수 없습니다: "]');
    expect(marked?.getAttribute('title')).toContain(
      useMedia.getState().items.find(item => item.id === warm)?.file,
    );
    expect(
      row(2).querySelector('[title^="파일을 찾을 수 없습니다"]'),
    ).toBeNull();
    expect(row(1).querySelector('[data-state~="warning"]')).not.toBeNull();
    expect(row(2).querySelector('[data-state~="warning"]')).toBeNull();
  });

  it('warns beside the background select when the chosen background file is missing, naming it', async () => {
    useMedia.setState({missing: new Set([warm])});
    renderEditor(
      song().map((slide, index) =>
        index === 0
          ? {...slide, background: {kind: 'media' as const, media: warm}}
          : slide,
      ),
    );
    await openTab('디자인');
    expect(
      inspector().getByRole('img', {
        name: /^배경 파일을 찾을 수 없습니다: 따뜻한 빛\./,
      }),
    ).toBeTruthy();
    expect(
      inspector().getByRole('button', {name: '배경'}).querySelector('img'),
    ).toBeNull();
  });

  it('is chosen at the right, and taken away again', async () => {
    const {current} = renderEditor(song());
    await openTab('디자인');
    const choose = async (name: string) => {
      await userEvent.click(inspector().getByRole('button', {name: '배경'}));
      fireEvent.change(screen.getByRole('combobox'), {target: {value: name}});
      fireEvent.click(screen.getByRole('option', {name}));
    };
    await choose('따뜻한 빛');
    expect(current.slides[0]?.background).toEqual({kind: 'media', media: warm});
    await choose('없음');
    expect(current.slides[0]?.background).toEqual({kind: 'none'});
    await choose('테마 배경');
    expect(current.slides[0]?.background).toBeUndefined();
  });

  it('is placed only after its place is opened, and put back by locking it', async () => {
    const {current} = renderEditor(
      song().map(slide => ({
        ...slide,
        background: {kind: 'media' as const, media: warm},
      })),
    );
    await openTab('디자인');
    const place = within(inspector().getByRole('group', {name: /^배경 위치/u}));
    const size = place.getByRole('spinbutton', {name: '크기'});
    expect(size.hasAttribute('readonly')).toBe(true);
    await userEvent.click(place.getByRole('button', {name: '편집'}));
    await userEvent.clear(size);
    await userEvent.type(size, '150{Enter}');
    expect(current.slides[0]?.background).toEqual({
      kind: 'media',
      media: warm,
      area: {x: 0, y: 0, scale: 1.5},
    });
    await userEvent.click(place.getByRole('button', {name: '기본값으로'}));
    expect(current.slides[0]?.background).toEqual({kind: 'media', media: warm});
  });

  it('is given to every slide', async () => {
    const {current} = renderEditor(
      song().map((slide, index) =>
        index === 0
          ? {...slide, background: {kind: 'media' as const, media: warm}}
          : slide,
      ),
    );
    await openTab('디자인');
    await userEvent.click(
      inspector().getByRole('button', {name: '배경을 전체 슬라이드에 적용'}),
    );
    expect(
      current.slides.every(slide => slide.background?.kind === 'media'),
    ).toBe(true);
  });
});

describe('the title slide of a hymn', () => {
  const hymn = () => [
    slideOf(1, 'songTitle', {theme: SONG_THEME_IDS.dark.hymnTitle}),
    ...song().slice(1),
  ];

  it('is told by its hymnal and its number', async () => {
    const {current} = renderEditor(hymn());
    await userEvent.click(row(0));
    await openTab('내용');
    const group = within(inspector().getByRole('group', {name: '찬송가'}));
    const number = group.getByRole('spinbutton', {name: '장 번호'});
    expect(number).toHaveProperty('value', '');
    await userEvent.type(number, '91{Enter}');
    expect(current.slides[0]?.hymn).toEqual({hymnal: 'new', number: 91});
    const own = (name: string): HTMLInputElement =>
      inspector().getByRole<HTMLInputElement>('textbox', {name});
    expect(own('찬송가').placeholder).toBe('새찬송가 91장');
    expect(own('제목').placeholder).toBe('슬픈 마음 있는 사람');
    expect(within(row(0)).queryAllByRole('textbox')).toHaveLength(0);
    await userEvent.clear(number);
    await userEvent.type(number, '600{Enter}');
    await userEvent.click(group.getByRole('radio', {name: '통일찬송가'}));
    expect(current.slides[0]?.hymn).toEqual({hymnal: 'unified', number: 558});
  });

  it('is asked for by no other theme', async () => {
    renderEditor(song());
    await userEvent.click(row(0));
    await openTab('내용');
    expect(inspector().queryByRole('group', {name: '찬송가'})).toBeNull();
  });
});

describe('showing the next slide', () => {
  const passage = () =>
    [1, 2].map(verse =>
      slideOf(verse, 'scripture', {
        texts: {본문: `본문 ${verse}`},
        verse: verseOf(verse),
      }),
    );
  const hide = () =>
    inspector().getByRole('checkbox', {name: '다음 슬라이드 내용 숨기기'});

  it('is off until the operator hides the next slide', async () => {
    const {current} = renderEditor(passage());
    await userEvent.click(row(1));
    await openTab('내용');
    expect(hide().getAttribute('aria-checked')).toBe('false');
    await userEvent.click(hide());
    expect(current.slides[1]?.hideNext).toBe(true);
    await userEvent.click(hide());
    expect(current.slides[1]).not.toHaveProperty('hideNext');
  });

  it('is said on the slide that does not show', async () => {
    renderEditor(passage());
    await userEvent.click(row(1));
    await openTab('내용');
    const note = /앞 슬라이드에서 이 내용을 보여주지 않도록/u;
    expect(inspector().queryByText(note)).toBeNull();
    await userEvent.click(row(0));
    await userEvent.click(hide());
    await userEvent.click(row(1));
    expect(inspector().getByText(note)).toBeTruthy();
  });
});
