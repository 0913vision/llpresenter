import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {render, screen, waitFor} from '@testing-library/react';
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
import {fullTranslationText} from '@fixtures/core/bible/testFiles';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {makeTempDir} from '@fixtures/tempDir';
import {convertBibleFile} from '../../scripts/bible/convert';

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
