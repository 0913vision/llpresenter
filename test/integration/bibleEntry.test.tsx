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
    expect(tenth.textContent).toContain('Alt+0');
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

it.each(['Tab', 'Enter'])(
  'adds a passage with %s using a converted 66-book placeholder translation',
  async key => {
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
    await user.keyboard(`{${key}}`);
    expect(book.value).toBe('창세기');
    expect(document.activeElement).toBe(chapter);
    await user.type(chapter, '1');
    await waitFor(() => expect(start.disabled).toBe(false));
    expect(book.getAttribute('aria-invalid')).toBeNull();
    await user.keyboard(`{${key}}`);
    expect(document.activeElement).toBe(start);
    await user.type(start, '1');
    await user.keyboard(`{${key}}`);
    expect(document.activeElement).toBe(end);
    expect(onChoose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '추가'})
          .getAttribute('aria-disabled'),
      ).toBeNull(),
    );
    await user.keyboard('{Enter}');
    expect(onChoose).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        ref: '창세기 1:1',
      }),
    );
    const chosen = onChoose.mock.calls[0]?.[0];
    expect(chosen?.verses).toHaveLength(1);
    expect(chosen?.verses[0]?.text).toContain('Invented book 1');
  },
);
