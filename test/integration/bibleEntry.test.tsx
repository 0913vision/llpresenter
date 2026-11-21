import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import type {
  BibleLookupPassage,
  BibleLookupRequest,
  BibleLookupReply,
} from '@core/schema/bibleLookup';
import {defaultPreferences} from '@core/schema/preferences';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {BibleLookupSession} from '@main/bible/lookup';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {fullTranslationText} from '@fixtures/core/bible/testFiles';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {makeTempDir} from '@fixtures/tempDir';
import {convertBibleFile} from '../../scripts/bible/convert';

it.each(['click', 'shortcut'] as const)(
  'selects the tenth recent in the add dialog with %s',
  async method => {
    commandBindingStore.set({});
    const fixture = panelApi();
    window.llp = fixture.api;
    onTestFinished(() => {
      delete window.llp;
    });
    const document = fixture.document();
    fixture.push({
      ...document,
      revision: 2,
      value: {
        ...document.value,
        recents: Array.from({length: 10}, (_, index) => ({
          translation: lookupRequest().translation,
          ref: `요한복음 3:${index + 1}`,
        })),
      },
    });
    const onChoose = vi.fn<(passage: BibleLookupPassage) => void>();
    render(
      <BiblePassageDialog
        api={fixture.api.bible}
        translation={lookupRequest().translation}
        onChoose={onChoose}
        onClose={vi.fn()}
      />,
    );
    const tenth = await screen.findByRole('button', {name: /요한복음 3:10/});
    expect(tenth.textContent).toContain('Alt0');
    if (method === 'click') fireEvent.click(tenth);
    else {
      fireEvent.blur(window);
      const field = screen.getByRole('combobox', {name: '책'});
      field.focus();
      fireEvent.keyDown(field, {key: '0', code: 'Digit0', altKey: true});
    }
    await waitFor(() =>
      expect(fixture.lookup).toHaveBeenCalledWith({
        input: '요한복음 3:10',
        translation: lookupRequest().translation,
      }),
    );
    await waitFor(() =>
      expect(onChoose).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ref: '요한복음 3:10'}),
      ),
    );
  },
);

it.each(['요한복음 3', '요한복음 3:16-4:2'])(
  'looks up the complete stored recent reference %s in the add dialog',
  async ref => {
    const fixture = panelApi();
    window.llp = fixture.api;
    onTestFinished(() => {
      delete window.llp;
    });
    const translation = lookupRequest().translation;
    const document = fixture.document();
    fixture.push({
      ...document,
      revision: 2,
      value: {...document.value, recents: [{translation, ref}]},
    });
    const onChoose = vi.fn<(passage: BibleLookupPassage) => void>();
    render(
      <BiblePassageDialog
        api={fixture.api.bible}
        translation={translation}
        onChoose={onChoose}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: new RegExp(ref.replace('-', '~')),
      }),
    );
    await waitFor(() =>
      expect(onChoose).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ref}),
      ),
    );
    expect(fixture.lookup).toHaveBeenCalledWith({input: ref, translation});
  },
);

it('navigates recent passages and closes the preparation dialog with Escape', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const settings = fixture.document();
  const translation = lookupRequest().translation;
  fixture.push({
    ...settings,
    revision: 2,
    value: {
      ...settings.value,
      recents: [
        {translation, ref: '요한복음 3:16'},
        {translation, ref: '요한복음 3:17'},
      ],
    },
  });
  const onClose = vi.fn();
  const onChoose = vi.fn<(passage: BibleLookupPassage) => void>();
  render(
    <BiblePassageDialog
      api={fixture.api.bible}
      translation={translation}
      onChoose={onChoose}
      onClose={onClose}
    />,
  );
  await screen.findByRole('button', {name: /3:17/});
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  book.focus();
  fireEvent.keyDown(book, {key: 'ArrowDown'});
  fireEvent.keyDown(book, {key: 'ArrowDown'});
  expect(document.activeElement).toBe(book);
  expect(
    screen.getByRole('button', {name: /3:17/}).getAttribute('data-highlighted'),
  ).toBe('true');
  fireEvent.change(book, {target: {value: 'ㅅ'}});
  expect(
    screen.getByRole('button', {name: /3:17/}).getAttribute('data-highlighted'),
  ).toBe('false');
  fireEvent.keyDown(book, {key: 'Escape'});
  expect(onClose).toHaveBeenCalledOnce();
});

it.each(['Enter', 'Tab'])(
  'selects a highlighted book with %s in the passage dialog',
  async key => {
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    onTestFinished(() => {
      HTMLElement.prototype.scrollIntoView = originalScroll;
    });
    const fixture = panelApi();
    window.llp = fixture.api;
    onTestFinished(() => {
      delete window.llp;
    });
    const onChoose = vi.fn();
    render(
      <BiblePassageDialog
        api={fixture.api.bible}
        translation={lookupRequest().translation}
        onChoose={onChoose}
        onClose={vi.fn()}
      />,
    );
    const book = await screen.findByRole<HTMLInputElement>('combobox', {
      name: '책',
    });
    book.focus();
    fireEvent.change(book, {target: {value: '베'}});
    fireEvent.keyDown(book, {key: 'ArrowDown'});
    fireEvent.keyDown(book, {key: 'ArrowDown'});
    expect(book.getAttribute('aria-activedescendant')).toBeTruthy();
    fireEvent.keyDown(book, {key});
    expect(book.value).toBe('베드로후서');
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', {name: '장'}),
    );
    expect(onChoose).not.toHaveBeenCalled();
  },
);

it('submits a valid passage by mouse and blocks an invalid passage', async () => {
  const onChoose = vi.fn();
  render(
    <BiblePassageDialog
      api={{lookup: formLookupReply}}
      translation={lookupRequest().translation}
      onChoose={onChoose}
      onClose={vi.fn()}
    />,
  );
  const book = screen.getByRole('combobox', {name: '책'});
  fireEvent.change(book, {target: {value: '요한복음'}});
  const chapter = screen.getByRole('textbox', {name: '장'});
  fireEvent.change(chapter, {target: {value: '3'}});
  const start = screen.getByRole('textbox', {name: '시작절'});
  fireEvent.change(start, {target: {value: '16'}});
  const add = screen.getByRole('button', {name: '추가'});
  await waitFor(() => expect(add.getAttribute('aria-disabled')).toBeNull());
  fireEvent.click(add);
  await waitFor(() => expect(onChoose).toHaveBeenCalledOnce());
  fireEvent.change(chapter, {target: {value: '99'}});
  fireEvent.click(add);
  expect(onChoose).toHaveBeenCalledOnce();
});

it('submits a full typed reference from the book field by mouse', async () => {
  const choose = vi.fn();
  render(
    <BiblePassageDialog
      api={{lookup: formLookupReply}}
      translation={lookupRequest().translation}
      onChoose={choose}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole('combobox', {name: '책'}), {
    target: {value: '요한복음 3:16'},
  });
  const add = screen.getByRole('button', {name: '추가'});
  await waitFor(() => expect(add.getAttribute('aria-disabled')).toBeNull());
  fireEvent.click(add);
  await waitFor(() => expect(choose).toHaveBeenCalledOnce());
});

it('closes the preparation dialog through its cancel button', () => {
  const close = vi.fn();
  render(
    <BiblePassageDialog
      api={{lookup: formLookupReply}}
      translation={lookupRequest().translation}
      onChoose={vi.fn()}
      onClose={close}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  expect(close).toHaveBeenCalledOnce();
});

it('ignores a recent lookup that resolves after clicking cancel', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const translation = lookupRequest().translation;
  const ref = '요한복음 3:17';
  const settings = fixture.document();
  fixture.push({
    ...settings,
    revision: 2,
    value: {...settings.value, recents: [{translation, ref}]},
  });
  const choose = vi.fn();
  const close = vi.fn();
  render(
    <BiblePassageDialog
      api={fixture.api.bible}
      translation={translation}
      onChoose={choose}
      onClose={close}
    />,
  );
  const recent = await screen.findByRole('button', {name: /3:17/});
  await waitFor(() => expect(fixture.lookup).toHaveBeenCalled());
  let finish: (reply: BibleLookupReply) => void = () => undefined;
  fixture.lookup.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  fireEvent.click(recent);
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  expect(close).toHaveBeenCalledOnce();
  await act(async () => finish(await formLookupReply(lookupRequest(ref))));
  expect(choose).not.toHaveBeenCalled();
});

it('cancels a pending typed submission when a recent is picked', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const settings = fixture.document();
  const translation = lookupRequest().translation;
  const typed = '요한복음 3:16';
  const recent = '요한복음 3:17';
  fixture.push({
    ...settings,
    revision: 2,
    value: {...settings.value, recents: [{translation, ref: recent}]},
  });
  let finish: (value: BibleLookupReply) => void = () => undefined;
  fixture.lookup.mockImplementation(request =>
    request.input === typed
      ? new Promise(resolve => {
          finish = resolve;
        })
      : formLookupReply(request),
  );
  const onChoose = vi.fn<(passage: BibleLookupPassage) => void>();
  render(
    <BiblePassageDialog
      api={fixture.api.bible}
      translation={translation}
      onChoose={onChoose}
      onClose={vi.fn()}
    />,
  );
  await screen.findByRole('button', {name: /3:17/});
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  fireEvent.change(book, {target: {value: '요한복음'}});
  fireEvent.change(screen.getByRole('textbox', {name: '장'}), {
    target: {value: '3'},
  });
  const start = screen.getByRole<HTMLInputElement>('textbox', {
    name: '시작절',
  });
  await waitFor(() => expect(start.disabled).toBe(false));
  fireEvent.change(start, {target: {value: '16'}});
  await waitFor(() =>
    expect(fixture.lookup).toHaveBeenCalledWith({input: typed, translation}),
  );
  fireEvent.keyDown(start, {key: 'Enter'});
  fireEvent.keyDown(start, {key: '1', code: 'Digit1', altKey: true});
  await waitFor(() =>
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: recent}),
    ),
  );
  await act(async () => finish(await formLookupReply(lookupRequest(typed))));
  expect(onChoose).toHaveBeenCalledOnce();
});

it('keeps focus in the dialog when pressing the scrim and footer', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const close = vi.fn();
  render(
    <BiblePassageDialog
      api={fixture.api.bible}
      translation={lookupRequest().translation}
      onChoose={vi.fn()}
      onClose={close}
    />,
  );
  const dialog = screen.getByRole('dialog');
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  book.focus();
  const scrim = dialog.parentElement;
  if (!scrim) throw Error('Missing scrim');
  expect(fireEvent.mouseDown(scrim, {cancelable: true})).toBe(false);
  const footer = dialog.querySelector('footer');
  if (!footer) throw Error('Missing footer');
  expect(fireEvent.mouseDown(footer, {cancelable: true})).toBe(false);
  expect(document.activeElement).toBe(book);
  fireEvent.keyDown(book, {key: 'Escape'});
  expect(close).toHaveBeenCalledOnce();
});

it('scrolls the highlighted recent into view while the caret stays in the book', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const settings = fixture.document();
  const translation = lookupRequest().translation;
  fixture.push({
    ...settings,
    revision: 2,
    value: {
      ...settings.value,
      recents: Array.from({length: 10}, (_, index) => ({
        translation,
        ref: `요한복음 3:${index + 1}`,
      })),
    },
  });
  const scroll = vi.fn();
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  onTestFinished(() => {
    HTMLElement.prototype.scrollIntoView = original;
  });
  render(
    <BiblePassageDialog
      api={fixture.api.bible}
      translation={translation}
      onChoose={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await screen.findByRole('button', {name: /3:10/});
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  book.focus();
  for (let index = 0; index < 10; index++) {
    fireEvent.keyDown(book, {key: 'ArrowDown'});
  }
  const tenth = screen.getByRole('button', {name: /3:10/});
  expect(tenth.getAttribute('data-highlighted')).toBe('true');
  expect(scroll).toHaveBeenLastCalledWith({block: 'nearest'});
  expect(scroll.mock.instances.at(-1)).toBe(tenth);
  expect(document.activeElement).toBe(book);
});

it('shows range placeholders and moves back from an empty argument', async () => {
  const onClose = vi.fn();
  render(
    <BiblePassageDialog
      api={{lookup: formLookupReply}}
      translation={lookupRequest().translation}
      onChoose={vi.fn()}
      onClose={onClose}
    />,
  );
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  fireEvent.change(book, {target: {value: '요한복음'}});
  const chapter = screen.getByRole<HTMLInputElement>('textbox', {
    name: '장',
  });
  await waitFor(() => expect(chapter.placeholder).toBe('1~21'));
  fireEvent.change(chapter, {target: {value: '3'}});
  const start = screen.getByRole<HTMLInputElement>('textbox', {
    name: '시작절',
  });
  await waitFor(() => expect(start.placeholder).toBe('1~36'));
  fireEvent.change(start, {target: {value: '16'}});
  const end = screen.getByRole<HTMLInputElement>('textbox', {
    name: '끝절',
  });
  expect(end.placeholder).toBe('16~36');
  end.focus();
  fireEvent.keyDown(end, {key: 'Backspace'});
  expect(document.activeElement).toBe(start);
  fireEvent.keyDown(start, {key: 'Escape'});
  expect(onClose).toHaveBeenCalledOnce();
});

it('adds from the dialog when Enter immediately follows the last digit', async () => {
  const onChoose = vi.fn<(passage: BibleLookupPassage) => void>();
  render(
    <BiblePassageDialog
      api={{lookup: formLookupReply}}
      translation={lookupRequest().translation}
      onChoose={onChoose}
      onClose={vi.fn()}
    />,
  );
  const book = screen.getByRole('combobox', {name: '책'});
  const chapter = screen.getByRole('textbox', {name: '장'});
  const start = screen.getByRole<HTMLInputElement>('textbox', {name: '시작절'});
  const end = screen.getByRole<HTMLInputElement>('textbox', {name: '끝절'});
  fireEvent.change(book, {target: {value: '요'}});
  fireEvent.change(chapter, {target: {value: '3'}});
  await waitFor(() => expect(start.disabled).toBe(false));
  fireEvent.change(start, {target: {value: '16'}});
  await waitFor(() => expect(end.disabled).toBe(false));
  act(() => {
    fireEvent.change(end, {target: {value: '18'}});
    fireEvent.keyDown(end, {key: 'Enter'});
  });
  await waitFor(() =>
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: '요한복음 3:16-18'}),
    ),
  );
});

it('adds a passage using Tab and Enter with a converted 66-book placeholder translation', async () => {
  const folder = await makeTempDir();
  const source = join(folder, 'source-v1.llbible');
  await writeFile(source, fullTranslationText());
  await convertBibleFile(source, join(folder, 'sample.llbible'));
  const bibleSettings = settingsDocument('bible', {
    translations: [
      {
        id: 'sample',
        name: 'Invented',
        lang: 'ko',
        file: 'sample.llbible',
        default: true,
      },
    ],
    recents: [],
  });
  const session = new BibleLookupSession({
    folder,
    settings: Promise.resolve({
      get: () => bibleSettings,
      preferences: () => defaultPreferences,
      subscribe: () => () => undefined,
    }),
    log: recordingLogger(),
  });
  onTestFinished(() => session.dispose());
  for (const book of BIBLE_BOOKS) {
    const reply = await session.lookup(lookupRequest(book.korean));
    expect(reply.bounds?.bookId).toBe(book.id);
    expect(reply.bounds?.chapterVerses).toHaveLength(book.chapters);
  }
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const onChoose = vi.fn<(passage: BibleLookupPassage) => void>();
  const lookup = vi.fn((request: BibleLookupRequest) =>
    session.lookup(request),
  );
  render(
    <BiblePassageDialog
      api={{lookup}}
      translation={lookupRequest().translation}
      onChoose={onChoose}
      onClose={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  const chapter = screen.getByRole('textbox', {name: '장'});
  const start = screen.getByRole<HTMLInputElement>('textbox', {
    name: '시작절',
  });
  const end = screen.getByRole('textbox', {name: '끝절'});
  await user.type(book, 'ckd');
  await user.keyboard('{Tab}');
  expect(book.value).toBe('창세기');
  expect(document.activeElement).toBe(chapter);
  await user.type(chapter, '1');
  await waitFor(() => expect(start.disabled).toBe(false));
  expect(book.getAttribute('aria-invalid')).toBeNull();
  await user.keyboard('{Tab}');
  expect(document.activeElement).toBe(start);
  await user.type(start, '1');
  await user.keyboard('{Tab}');
  expect(document.activeElement).toBe(end);
  expect(onChoose).not.toHaveBeenCalled();
  await user.keyboard('{Enter}');
  expect(onChoose).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      ref: '창세기 1:1',
    }),
  );
  const chosen = onChoose.mock.calls[0]?.[0];
  expect(chosen?.verses).toHaveLength(1);
  expect(chosen?.verses[0]?.text).toContain('Invented book 1');
});

it.each(['book', 'chapter', 'start', 'end'] as const)(
  'adds the typed passage from the %s field',
  async part => {
    const fixture = panelApi();
    window.llp = fixture.api;
    onTestFinished(() => {
      delete window.llp;
    });
    const onChoose = vi.fn();
    render(
      <BiblePassageDialog
        api={fixture.api.bible}
        translation={lookupRequest().translation}
        onChoose={onChoose}
        onClose={vi.fn()}
      />,
    );
    const book = screen.getByRole('combobox', {name: '책'});
    const chapter = screen.getByRole('textbox', {name: '장'});
    const start = screen.getByRole<HTMLInputElement>('textbox', {
      name: '시작절',
    });
    const end = screen.getByRole('textbox', {name: '끝절'});
    fireEvent.change(book, {target: {value: '요'}});
    fireEvent.change(chapter, {target: {value: '3'}});
    await waitFor(() => expect(start.disabled).toBe(false));
    fireEvent.change(start, {target: {value: '16'}});
    fireEvent.change(end, {target: {value: '18'}});
    const field = {book, chapter, start, end}[part];
    field.focus();
    fireEvent.keyDown(field, {key: 'Enter', code: 'Enter'});
    await waitFor(() =>
      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ref: '요한복음 3:16-18'}),
      ),
    );
  },
);
