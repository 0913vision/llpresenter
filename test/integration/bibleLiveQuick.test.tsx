import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';
import {defaultPreferences} from '@core/schema/preferences';
import {BibleLookupSession} from '@main/bible/lookup';
import {BibleQuickField} from '@renderer/features/quick/BibleQuickField';
import {useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {emptyLiveState} from '@core/live/state';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {makeTempDir} from '@fixtures/tempDir';
import {
  chunkedTranslationFile,
  translationFile,
} from '@fixtures/core/bible/testFiles';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  seedSampleService();
  useShow.setState({
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    openItemId: null,
    selectedTile: 0,
  });
  useLive.setState({state: emptyLiveState(), lastStartedItemId: null});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.llp;
});

it.each([false, true])(
  'finds every book in quick Bible entry with no file or a one-book default: partial=%s',
  async partial => {
    const folder = await makeTempDir();
    if (partial) {
      await writeFile(
        join(folder, 'gae.llbible'),
        chunkedTranslationFile(translationFile([35])).bytes,
      );
    }
    const fixture = panelApi();
    const base = fixture.document();
    const installed = base.value.translations[0];
    if (!installed) throw Error('Missing translation fixture');
    fixture.push({
      ...base,
      revision: 2,
      value: {
        ...base.value,
        translations: [
          {
            ...installed,
            id: lookupRequest('', partial ? 'gae' : 'krv').translation,
            file: partial ? 'gae.llbible' : 'krv.llbible',
          },
        ],
      },
    });
    const document = fixture.document();
    const session = new BibleLookupSession({
      folder,
      settings: Promise.resolve({
        get: () => document,
        preferences: () => defaultPreferences,
        subscribe: () => () => undefined,
      }),
      log: recordingLogger(),
    });
    const html = `<div id="tdBible1">${Array.from({length: 36}, (_, index) => `<span><b class="number">${index + 1}</b>placeholder</span>`).join('')}</div>`;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ok: true, text: async () => html}),
    );
    fixture.lookup.mockImplementation(request =>
      session.lookup(request, false, true),
    );
    window.llp = fixture.api;
    try {
      render(<BibleQuickField api={fixture.api} />);
      const book = screen.getByRole<HTMLInputElement>('combobox', {
        name: '\uCC45',
      });
      await waitFor(() => expect(book.disabled).toBe(false));
      for (const [name, chapter, start, end, ref] of [
        ['\uD569', '3', '17', '19', '\uD558\uBC15\uAD6D 3:17-19'],
        ['\uC694', '3', '16', '16', '\uC694\uD55C\uBCF5\uC74C 3:16'],
      ]) {
        fireEvent.change(book, {target: {value: name}});
        expect(book.getAttribute('aria-invalid')).toBeNull();
        const chapterField = screen.getByRole<HTMLInputElement>('textbox', {
          name: '\uC7A5',
        });
        fireEvent.change(chapterField, {target: {value: chapter}});
        const startField = screen.getByRole<HTMLInputElement>('textbox', {
          name: '\uC2DC\uC791\uC808',
        });
        await waitFor(() => expect(startField.disabled).toBe(false));
        fireEvent.change(startField, {target: {value: start}});
        const endField = screen.getByRole<HTMLInputElement>('textbox', {
          name: '\uB05D\uC808',
        });
        await waitFor(() => expect(endField.disabled).toBe(false));
        fireEvent.change(endField, {target: {value: end}});
        await waitFor(() =>
          expect(useShow.getState().bibleSource?.passage).toMatchObject({
            ref,
            translation: LIVE_BIBLE_ID,
          }),
        );
      }
    } finally {
      session.dispose();
    }
  },
);
