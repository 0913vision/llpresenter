import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import type {
  BibleLookupPassage,
  BibleLookupRequest,
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
      const field = screen.getByRole('combobox', {name: '\uCC45'});
      field.focus();
      fireEvent.keyDown(field, {key: '0', code: 'Digit0', altKey: true});
    }
    await waitFor(() =>
      expect(fixture.lookup).toHaveBeenCalledWith({
        input: '\uC694\uD55C\uBCF5\uC74C 3:10',
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

it.each(['\uC694\uD55C\uBCF5\uC74C 3', '\uC694\uD55C\uBCF5\uC74C 3:16-4:2'])(
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

it('navigates recent passages and clears the preparation dialog with Escape', async () => {
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
        {translation, ref: '\uC694\uD55C\uBCF5\uC74C 3:16'},
        {translation, ref: '\uC694\uD55C\uBCF5\uC74C 3:17'},
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
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '\uCC45'});
  book.focus();
  fireEvent.keyDown(book, {key: 'ArrowDown'});
  fireEvent.keyDown(book, {key: 'ArrowDown'});
  expect(document.activeElement).toBe(book);
  expect(
    screen.getByRole('button', {name: /3:17/}).getAttribute('data-highlighted'),
  ).toBe('true');
  fireEvent.change(book, {target: {value: '\u3145'}});
  expect(
    screen.getByRole('button', {name: /3:17/}).getAttribute('data-highlighted'),
  ).toBe('false');
  fireEvent.keyDown(book, {key: 'Escape'});
  const clearedBook = screen.getByRole<HTMLInputElement>('combobox', {
    name: '\uCC45',
  });
  expect(clearedBook.value).toBe('');
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(clearedBook, {key: 'Escape'});
  expect(onClose).toHaveBeenCalledOnce();
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
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '\uCC45'});
  fireEvent.change(book, {target: {value: '\uC694\uD55C\uBCF5\uC74C'}});
  const chapter = screen.getByRole<HTMLInputElement>('textbox', {
    name: '\uC7A5',
  });
  await waitFor(() => expect(chapter.placeholder).toBe('1~21'));
  fireEvent.change(chapter, {target: {value: '3'}});
  const start = screen.getByRole<HTMLInputElement>('textbox', {
    name: '\uC2DC\uC791\uC808',
  });
  await waitFor(() => expect(start.placeholder).toBe('1~36'));
  fireEvent.change(start, {target: {value: '16'}});
  const end = screen.getByRole<HTMLInputElement>('textbox', {
    name: '\uB05D\uC808',
  });
  expect(end.placeholder).toBe('16~36');
  end.focus();
  fireEvent.keyDown(end, {key: 'Backspace'});
  expect(document.activeElement).toBe(start);
  fireEvent.keyDown(start, {key: 'Escape'});
  expect(
    screen.getByRole<HTMLInputElement>('combobox', {name: '\uCC45'}).value,
  ).toBe('');
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('combobox', {name: '\uCC45'}), {
    key: 'Escape',
  });
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
