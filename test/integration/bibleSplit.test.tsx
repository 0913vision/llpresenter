import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  SettingsDocument,
  SettingsName,
} from '@core/schema/settingsDocuments';
import {createServiceItemId} from '@core/schema/ids';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {emptyLiveState} from '@core/live/state';
import {parseLiveCommand} from '@core/schema/liveCommand';
import * as bibleRendering from '@renderer/rendering/bibleMeasure';
import type {Notice} from '@renderer/ui/notices';
import {BibleSplitTools} from '@renderer/features/bible/BibleSplitTools';
import {BibleQuickField} from '@renderer/features/quick/BibleQuickField';
import {
  openBiblePassage,
  showBiblePassage,
} from '@renderer/features/bible/actions';
import {
  applyService,
  outputTile,
  outputNext,
  liveCursor,
  tilesOf,
  useShow,
} from '@renderer/session/show';
import {liveTileIndex} from '@renderer/session/showLibrary';
import {confirmBibleCuts} from '@renderer/features/bible/saveBibleCuts';
import {ShowShortcuts} from '@renderer/app/workspaces/showPanels';
import {noService} from '@renderer/session/showStore';
import {useLive} from '@renderer/session/live';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themeFile, THEME_MAIN} from '@fixtures/core/themeOutput';
import {MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@renderer/rendering/bibleMeasure', async importOriginal => {
  const original =
    await importOriginal<typeof import('@renderer/rendering/bibleMeasure')>();
  return {
    ...original,
    createBibleMeasureContext: () => ({
      font: '',
      measureText(text: string) {
        return {
          width:
            (Array.from(text).length *
              Number(/(\d+)px/.exec(this.font)?.[1] ?? 36)) /
            2,
        };
      },
    }),
  };
});

const sourceId = createServiceItemId('00000000-0000-4000-8000-000000000099');
const passage = {
  ...panelPassage(),
  ref: '요한복음 3:16-17',
  displayRef: '요한복음 3:16~17',
  verses: [
    {chapter: 3, verse: 16, text: MOCK_LONG_VERSE},
    {chapter: 3, verse: 17, text: '새가 노래한다'},
  ],
};
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: new EventTarget(),
  });
  useShow.setState({
    ...noService,
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    librarySong: null,
    openItemId: null,
    selectedTile: 0,
  });
  useLive.setState({
    state: emptyLiveState(),
    lastStartedItemId: null,
    commandVersion: 0,
  });
});

afterEach(() => {
  delete window.llp;
  if (originalFonts === undefined) Reflect.deleteProperty(document, 'fonts');
  else Object.defineProperty(document, 'fonts', originalFonts);
});

function setup() {
  const file = themeFile();
  const themes = {
    ...file,
    themes: file.themes.map(theme => ({
      ...theme,
      screens: Object.fromEntries(
        Object.entries(theme.screens).map(([id, layout]) => [
          id,
          {
            ...layout,
            elements: layout.elements.map(element =>
              element.kind !== 'currentText'
                ? element
                : {
                    ...element,
                    frame: {x: 0, y: 0, w: 300, h: 100},
                    text: {
                      ...element.text,
                      size: 36,
                      lineHeight: 1.25,
                      maxLines: 2,
                    },
                  },
            ),
          },
        ]),
      ),
    })),
  };
  const documents = new Map<SettingsName, SettingsDocument>([
    ['themes', settingsDocument('themes', themes)],
    [
      'screens',
      settingsDocument('screens', {
        screens: [
          {
            id: THEME_MAIN,
            name: '청중',
            kind: 'audience',
            method: 'fullscreen',
          },
        ],
      }),
    ],
    ['bibleCuts', settingsDocument('bibleCuts', {entries: {}})],
    [
      'bible',
      settingsDocument('bible', {
        translations: [
          {
            id: passage.translation,
            name: 'Sample',
            lang: 'ko',
            file: 'sample.llbible',
            default: true,
          },
        ],
        recents: [],
      }),
    ],
  ]);
  const listeners = new Set<(document: SettingsDocument) => void>();
  const send = vi.fn<LlpApi['live']['send']>();
  const edit = vi.fn<LlpApi['settings']['edit']>(async request => {
    if (request.type !== 'settings.update') throw Error('Unexpected edit');
    const current = documents.get(request.name);
    if (current === undefined) throw Error('Missing settings');
    const next = settingsDocument(
      request.name,
      request.value,
      current.revision + 1,
    );
    documents.set(request.name, next);
    for (const listener of listeners) listener(next);
    return {ok: true, value: {id: request.name, revision: next.revision}};
  });
  window.llp = mockLlpApi({
    bible: {
      lookup: async request => ({
        ...request,
        bounds: {bookId: 43, chapterVerses: Array.from({length: 21}, () => 40)},
        suggestions: [],
        result: {ok: true, value: passage},
      }),
    },
    live: {send},
    settings: {
      get: async request => {
        const found = documents.get(request.name);
        if (found === undefined) throw Error('Missing settings');
        return found;
      },
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  });
  return {documents, send, edit};
}

describe('prepare and reuse theme-fitted Bible slides', () => {
  it.each([false, true])(
    'retains a continuation selection across a workspace round trip, respecting a new selection %s',
    async changedWhileAway => {
      const fixture = setup();
      openBiblePassage(passage);
      const view = render(<ShowShortcuts onProblem={vi.fn()} />);
      await screen.findByRole('dialog', {name: '절 나누기'});
      await act(async () =>
        fireEvent.click(screen.getByRole('button', {name: '확정'})),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const id = useShow.getState().openItemId;
      if (id === null) throw Error('Missing source');
      const before = tilesOf(id);
      expect(before[1]).toMatchObject({label: '3:16', biblePart: 2});
      act(() => useShow.setState({selectedTile: 1}));
      view.rerender(<span>준비</span>);
      expect(tilesOf(id)).toHaveLength(passage.verses.length);
      if (changedWhileAway) act(() => useShow.setState({selectedTile: 1}));
      view.rerender(<ShowShortcuts onProblem={vi.fn()} />);
      await waitFor(() => expect(tilesOf(id).length).toBe(before.length));
      const index = changedWhileAway
        ? before.findIndex(tile => tile.label === '3:17')
        : 1;
      expect(useShow.getState().selectedTile).toBe(index);
      expect(tilesOf(id)[index]).toMatchObject({
        label: changedWhileAway ? '3:17' : '3:16',
        biblePart: changedWhileAway ? 1 : 2,
      });
      expect(fixture.send).not.toHaveBeenCalled();
      view.unmount();
    },
  );

  it.each(['saved', 'panel'] as const)(
    'retains selection and live navigation when %s cuts add a part before the live verse',
    async mode => {
      const fixture = setup();
      const extended = {
        ...passage,
        ref: '요한복음 3:16-18',
        displayRef: '요한복음 3:16-18',
        verses: [
          ...passage.verses,
          {chapter: 3, verse: 18, text: '바람이 분다'},
        ],
      };
      if (mode === 'saved') {
        applyService({
          revision: 1,
          id: 'service',
          name: 'Sample',
          readOnly: false,
          rows: [
            {
              kind: 'bible',
              id: sourceId,
              title: extended.ref,
              bible: {
                translation: extended.translation,
                ref: extended.ref,
                passage: extended,
              },
            },
          ],
          tiles: {[sourceId]: bibleVerseTiles(extended)},
          jumpKeys: {},
        });
        useShow.setState({openItemId: sourceId});
      } else openBiblePassage(extended);
      const view = render(<BibleSplitTools onProblem={vi.fn()} />);
      await screen.findByRole('dialog', {name: '절 나누기'});
      await act(async () =>
        fireEvent.click(screen.getByRole('button', {name: '확정'})),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const id = useShow.getState().openItemId;
      if (id === null) throw Error('Missing source');
      const before = tilesOf(id).findIndex(tile => tile.label === '3:17');
      act(() => outputTile({itemId: id, index: before}));
      const command = fixture.send.mock.calls.at(-1)?.[0];
      if (command?.type !== 'slide.show') throw Error('Missing live slide');
      expect(command.slide.biblePart).toBe(1);
      act(() =>
        useLive.setState(state => ({
          state: {
            ...emptyLiveState(),
            ...state.state,
            layers: {...emptyLiveState().layers, slide: command.slide},
          },
        })),
      );
      fixture.send.mockClear();
      const document = fixture.documents.get('bibleCuts');
      const api = window.llp;
      if (document?.name !== 'bibleCuts' || api === undefined) {
        throw Error('Missing cuts API');
      }
      const cuts =
        document.value.entries[passage.translation]?.['43:3:16']?.cuts;
      if (cuts === undefined || cuts.includes(1)) {
        throw Error('Unexpected initial cuts');
      }
      await act(async () =>
        confirmBibleCuts(
          api.settings,
          {
            reference: {
              translation: passage.translation,
              book: 43,
              chapter: 3,
              verse: 16,
            },
            text: MOCK_LONG_VERSE,
          },
          [1, ...cuts],
        ),
      );
      await waitFor(() =>
        expect(tilesOf(id).findIndex(tile => tile.label === '3:17')).toBe(
          before + 1,
        ),
      );
      expect(useShow.getState().selectedTile).toBe(before + 1);
      expect(liveCursor()).toEqual({itemId: id, index: before + 1});
      expect(liveTileIndex(useShow.getState(), command.slide)).toBe(before + 1);
      expect(useLive.getState().state?.layers.slide).toBe(command.slide);
      expect(fixture.send).not.toHaveBeenCalled();
      if (mode === 'panel') act(() => useShow.setState({openItemId: null}));
      act(() => outputNext());
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {label: '3:18', biblePart: 1},
      });
      view.unmount();
    },
  );

  it('releases settings subscriptions when the font loading API is unavailable', async () => {
    const fixture = setup();
    Reflect.deleteProperty(document, 'fonts');
    const unsubscribe = vi.fn();
    if (window.llp === undefined) throw Error('Missing API');
    vi.spyOn(window.llp.settings, 'subscribe').mockReturnValue(unsubscribe);
    const view = render(<BibleSplitTools onProblem={vi.fn()} />);
    act(() => openBiblePassage(passage, {verseNumbers: true, review: false}));
    await waitFor(() =>
      expect(
        tilesOf(useShow.getState().openItemId ?? '').length,
      ).toBeGreaterThan(2),
    );
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(3);
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('reports measurement failure and keeps the whole verse inside live line limits', async () => {
    const fixture = setup();
    vi.spyOn(bibleRendering, 'createBibleMeasureContext').mockReturnValue({
      font: '',
      measureText: () => {
        throw Error('Missing font measure');
      },
    });
    const onProblem = vi.fn<(notice: Notice) => void>();
    const text = '가'.repeat(8_000);
    openBiblePassage({
      ...passage,
      ref: '요한복음 3:16',
      displayRef: '요한복음 3:16',
      verses: [{chapter: 3, verse: 16, text}],
    });
    const view = render(<BibleSplitTools onProblem={onProblem} />);
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0]?.[0].title).toBe('성경 구절 나누기 실패');
    const id = useShow.getState().openItemId;
    if (id === null) throw Error('Missing source');
    expect(tilesOf(id)[0]?.lines.join('')).toBe(text);
    act(() => outputTile({itemId: id, index: 0}));
    const command = fixture.send.mock.calls.at(-1)?.[0];
    expect(parseLiveCommand(command).ok).toBe(true);
    view.unmount();
  });
  it('cancels the requested preview while retaining reference fields and returning focus to the end verse', async () => {
    const fixture = setup();
    const api = window.llp;
    if (api === undefined) throw Error('Missing API');
    openBiblePassage(passage, {verseNumbers: true, review: false});
    const view = render(
      <>
        <BibleQuickField api={api} />
        <BibleSplitTools onProblem={vi.fn()} />
      </>,
    );
    await waitFor(() =>
      expect(
        tilesOf(useShow.getState().openItemId ?? '').length,
      ).toBeGreaterThan(2),
    );
    const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
    const end = screen.getByRole<HTMLInputElement>('textbox', {name: '끝절'});
    await waitFor(() => expect(book.disabled).toBe(false));
    fireEvent.change(book, {target: {value: '요한복음'}});
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>('textbox', {name: '장'}).disabled,
      ).toBe(false),
    );
    fireEvent.change(screen.getByRole('textbox', {name: '장'}), {
      target: {value: '3'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: '시작절'}), {
      target: {value: '16'},
    });
    fireEvent.change(end, {target: {value: '17'}});
    await waitFor(() => expect(end.disabled).toBe(false));
    act(() => showBiblePassage(passage));
    await screen.findByRole('dialog', {name: '절 나누기'});
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
      code: 'Escape',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      screen.getByRole<HTMLInputElement>('combobox', {name: '책'}).value,
    ).toBe('요한복음');
    expect(
      screen.getByRole<HTMLInputElement>('textbox', {name: '끝절'}).value,
    ).toBe('17');
    await waitFor(() => expect(document.activeElement).toBe(end));
    expect(fixture.edit).not.toHaveBeenCalled();
    expect(fixture.send).not.toHaveBeenCalled();
    view.unmount();
  });
  it.each([false, true])(
    'waits for review before output and respects interruption %s',
    async interrupted => {
      const fixture = setup();
      openBiblePassage(passage, {verseNumbers: true, review: false});
      const view = render(<BibleSplitTools onProblem={vi.fn()} />);
      await waitFor(() => {
        const id = useShow.getState().openItemId;
        expect(id === null ? 0 : tilesOf(id).length).toBeGreaterThan(2);
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      act(() => showBiblePassage(passage));
      await screen.findByRole('dialog', {name: '절 나누기'});
      expect(fixture.send).not.toHaveBeenCalled();
      if (interrupted) {
        act(() =>
          useLive.setState(state => ({
            commandVersion: state.commandVersion + 1,
          })),
        );
      }
      await act(async () =>
        fireEvent.click(screen.getByRole('button', {name: '확정'})),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const outputs = fixture.send.mock.calls.filter(
        ([command]) => command.type === 'slide.show',
      );
      expect(outputs).toHaveLength(interrupted ? 0 : 1);
      view.unmount();
    },
  );

  it.each(['saved', 'panel'] as const)(
    'confirms %s verse cuts, reopens them with Ctrl E, and outputs the split part',
    async mode => {
      const fixture = setup();
      if (mode === 'saved') {
        applyService({
          revision: 1,
          id: 'service',
          name: 'Sample',
          readOnly: false,
          rows: [
            {
              kind: 'bible',
              id: sourceId,
              title: passage.ref,
              bible: {
                translation: passage.translation,
                ref: passage.ref,
                passage,
              },
            },
          ],
          tiles: {[sourceId]: bibleVerseTiles(passage)},
          jumpKeys: {},
        });
        useShow.setState({openItemId: sourceId});
      } else openBiblePassage(passage);
      const view = render(<BibleSplitTools onProblem={vi.fn()} />);
      await screen.findByRole('dialog', {name: '절 나누기'});
      const id = useShow.getState().openItemId;
      if (id === null) throw Error('Missing source');
      expect(tilesOf(id).length).toBeGreaterThan(passage.verses.length);
      await act(async () =>
        fireEvent.click(screen.getByRole('button', {name: '확정'})),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const stored = fixture.documents.get('bibleCuts');
      if (stored?.name !== 'bibleCuts') throw Error('Missing cuts');
      expect(
        stored.value.entries[passage.translation]?.['43:3:16']?.cuts.length,
      ).toBeGreaterThan(0);
      expect(JSON.stringify(stored.value)).not.toContain(MOCK_LONG_VERSE);
      fireEvent.keyDown(document.body, {key: 'e', code: 'KeyE', ctrlKey: true});
      await screen.findByRole('dialog', {name: '절 나누기'});
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
        code: 'Escape',
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      act(() => outputTile({itemId: id, index: 0}));
      const command = fixture.send.mock.calls
        .map(([command]) => command)
        .find(command => command.type === 'slide.show');
      expect(command).toMatchObject({
        type: 'slide.show',
        slide: {continued: true, reference: '요한복음 3:16'},
      });
      if (mode === 'panel') {
        const last = tilesOf(id).length - 1;
        act(() => {
          useShow.setState({selectedTile: last});
          showBiblePassage(passage);
        });
        expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
          type: 'slide.show',
          slide: {position: last, continued: false},
        });
      }
      view.unmount();
    },
  );
});
