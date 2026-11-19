import {
  lastLiveCommand,
  liveCommands,
} from '@fixtures/renderer/session/liveCommands';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  SettingsDocument,
  SettingsName,
} from '@core/schema/settingsDocuments';
import {createServiceId, createServiceItemId} from '@core/schema/ids';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {emptyLiveState} from '@core/live/state';
import {parseLiveCommand} from '@core/schema/liveCommand';
import * as bibleRendering from '@renderer/rendering/bibleMeasure';
import type {Notice} from '@renderer/ui/notices';
import {BibleSplitTools} from '@renderer/features/bible/BibleSplitTools';
import {bibleRefinements} from '@renderer/features/bible/BibleRefinements';
import {BibleQuickField} from '@renderer/features/quick/BibleQuickField';
import {QuickPanel} from '@renderer/features/quick/QuickPanel';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {DetailsPanel} from '@renderer/features/service/details/DetailsPanel';
import {ServiceItemPanel} from '@renderer/features/service/items/SongItemPanel';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {splitVerse} from '@core/bible/split/splitter';
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
import {mockSplitLayout, MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import {defaultPreferences} from '@core/schema/preferences';
import {quickDocument} from '@fixtures/renderer/features/tools/quickTesting';
import {previewSpec} from '@fixtures/renderer/picture';

vi.mock(
  '@renderer/rendering/pictures/Picture',
  () => import('@fixtures/renderer/picture'),
);

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
  it.each(['show', 'prep', 'details'])(
    'draws the measured Bible rows at the theme size in the %s tiles',
    async workspace => {
      const layout = mockSplitLayout();
      vi.spyOn(bibleRendering, 'bibleMeasure').mockReturnValue(layout);
      setup();
      const api = window.llp;
      if (api === undefined) throw Error('Missing API');
      const serviceId = createServiceId('00000000-0000-4000-8000-000000000098');
      const item = {
        id: sourceId,
        bible: {
          translation: passage.translation,
          ref: passage.ref,
          split: 'verse' as const,
          reference: 'every' as const,
          verseNumbers: true,
          translationName: false,
        },
      };
      const service = parseServiceDocument({
        service: {
          format: 'llservice',
          schemaVersion: 1,
          id: serviceId,
          name: 'Sample',
          date: '2026-11-07T10:00',
          order: [item],
        },
        revision: 1,
        access: 'editable',
      });
      if (!service.ok || service.value === null) throw Error('Invalid service');
      vi.spyOn(api.services, 'get').mockResolvedValue(service.value);
      if (workspace === 'show') {
        openBiblePassage(passage, {review: false, verseNumbers: true});
      } else {
        applyService({
          revision: 1,
          id: serviceId,
          name: 'Sample',
          readOnly: false,
          rows: [
            {
              id: sourceId,
              kind: 'bible',
              title: passage.ref,
              bible: {...item.bible, passage},
            },
          ],
          tiles: {[sourceId]: bibleVerseTiles(passage)},
        });
        useShow.setState({openItemId: sourceId});
      }
      const editor =
        workspace !== 'show' ? new SongEditorStore(api, vi.fn()) : null;
      const items =
        editor === null ? null : new ServiceItemStore(api, editor, vi.fn());
      const view = render(
        workspace === 'show' ? (
          <>
            <BibleSplitTools onProblem={vi.fn()} />
            <BiblePanel sizeClass="normal" />
          </>
        ) : items === null || editor === null ? null : workspace === 'prep' ? (
          <ServiceItemPanel items={items} editor={editor} sizeClass="normal" />
        ) : (
          <DetailsPanel
            sizeClass="normal"
            target={{kind: 'item', itemId: sourceId}}
            api={api}
            items={items}
            editor={editor}
          />
        ),
      );
      try {
        if (workspace === 'details') {
          fireEvent.click(await screen.findByRole('tab', {name: '슬라이드'}));
        }
        const verse = passage.verses[0];
        if (verse === undefined) throw Error('Missing verse');
        const expected = splitVerse(verse.text, layout, {prefix: '16 '})
          .chunks[0]?.lines;
        await waitFor(() => {
          const first = screen.getAllByRole('option')[0];
          const spec = previewSpec(first);
          expect(spec?.layers.slide?.lines).toEqual(expected);
          expect(
            spec?.appearance.theme.layout.elements.find(
              element => element.kind === 'currentText',
            )?.text.size,
          ).toBe(36);
        });
        if (workspace !== 'details') {
          expect(
            screen.getByRole('group', {name: '슬라이드 크기'}),
          ).toBeDefined();
        }
        if (workspace === 'prep') {
          const first = screen.getAllByRole('option')[0];
          if (first === undefined) throw Error('Missing tile');
          fireEvent.contextMenu(first);
          expect(
            screen.getByRole('menuitem', {name: '오버레이 추가…'}),
          ).toBeDefined();
        }
      } finally {
        view.unmount();
        items?.dispose();
        await editor?.dispose();
      }
    },
  );

  it.each(['click', 'Enter'])(
    'outputs a saved quick Bible item by %s without AI or review',
    async activation => {
      vi.spyOn(bibleRendering, 'bibleMeasure').mockReturnValue(
        mockSplitLayout(),
      );
      const f = setup();
      const api = window.llp;
      if (api === undefined) throw Error('Missing API');
      const quick = quickDocument();
      f.documents.set('quick', {
        ...quick,
        value: {
          ...quick.value,
          items: quick.value.items.filter(item => item.kind === 'bible'),
        },
      });
      f.documents.set('timers', settingsDocument('timers', {timers: []}));
      const status = vi.spyOn(api.bible, 'getLlmStatus').mockResolvedValue({
        status: 'ready',
        available: true,
        reason: '',
      });
      const subscribe = vi.spyOn(api.bible, 'onLlmStatus');
      const chooser = vi
        .spyOn(api.bible, 'chooseBoundary')
        .mockResolvedValue(0);
      const text = MOCK_LONG_VERSE.replaceAll('.', '').replace(
        '작은',
        activation === 'click' ? '작은' : '고운',
      );
      const range = {...passage, verses: [{chapter: 3, verse: 16, text}]};
      vi.spyOn(api.bible, 'lookup').mockImplementation(async request => ({
        ...request,
        suggestions: [],
        result: {ok: true, value: range},
      }));
      const opened: Array<boolean | undefined> = [];
      const stop = useShow.subscribe(view => {
        if (view.bibleSource !== null) opened.push(view.bibleSource.review);
      });
      const view = render(
        <>
          <QuickPanel selectionVersion={0} onProblem={vi.fn()} />
          <BiblePanel sizeClass="normal" />
          <BibleSplitTools onProblem={vi.fn()} />
        </>,
      );
      try {
        const item = await screen.findByRole('button', {name: '저장된 구절'});
        if (activation === 'click') fireEvent.click(item);
        else {
          item.focus();
          await userEvent.setup().keyboard('{Enter}');
        }
        await waitFor(() => {
          const source = useShow.getState().bibleSource;
          expect(source?.passage.ref).toBe(range.ref);
          expect(lastLiveCommand(f.send.mock.calls.at(-1)?.[0])).toMatchObject({
            type: 'slide.show',
            slide: {itemId: source?.id, position: 0},
          });
        });
        const panel = await screen.findByRole('region', {name: '성경'});
        expect(
          within(panel).getByRole('checkbox', {name: '역본 이름'}),
        ).toBeDefined();
        expect(within(panel).queryByText('AI 켜짐')).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(status).not.toHaveBeenCalled();
        expect(subscribe).not.toHaveBeenCalled();
        expect(chooser).not.toHaveBeenCalled();
        expect(opened.length).toBeGreaterThan(0);
        expect(opened.every(review => review === false)).toBe(true);
      } finally {
        stop();
        view.unmount();
      }
    },
  );

  it('outputs a quick lookup immediately without AI or a review window even when AI is ready', async () => {
    const f = setup();
    const api = window.llp;
    if (api === undefined) throw Error('Missing API');
    const status = vi.spyOn(api.bible, 'getLlmStatus').mockResolvedValue({
      status: 'ready',
      available: true,
      reason: '',
    });
    const chooser = vi.spyOn(api.bible, 'chooseBoundary').mockResolvedValue(0);
    const view = render(
      <>
        <BibleQuickField api={api} />
        <BibleSplitTools onProblem={vi.fn()} />
      </>,
    );
    const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
    await waitFor(() => expect(book.disabled).toBe(false));
    fireEvent.change(book, {target: {value: '요한복음'}});
    for (const [label, value] of [
      ['장', '3'],
      ['시작절', '16'],
      ['끝절', '17'],
    ] as const) {
      const input = screen.getByRole<HTMLInputElement>('textbox', {
        name: label,
      });
      await waitFor(() => expect(input.disabled).toBe(false));
      fireEvent.change(input, {target: {value}});
    }
    const end = screen.getByRole('textbox', {name: '끝절'});
    await waitFor(() =>
      expect(useShow.getState().bibleSource?.passage.ref).toBe(passage.ref),
    );
    await act(async () =>
      fireEvent.keyDown(end, {key: 'Enter', code: 'Enter'}),
    );
    await waitFor(() => expect(f.send).toHaveBeenCalled());
    expect(useShow.getState().bibleSource?.review).toBe(false);
    expect(status).not.toHaveBeenCalled();
    expect(chooser).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();
  });
  it('keeps the rule-based Show tiles when an unconfirmed AI suggestion arrives', async () => {
    vi.spyOn(bibleRendering, 'bibleMeasure').mockReturnValue(mockSplitLayout());
    setup();
    const api = window.llp;
    if (api === undefined) throw Error('Missing API');
    const status = vi.spyOn(api.bible, 'getLlmStatus').mockResolvedValue({
      status: 'ready',
      available: true,
      reason: '',
    });
    const chooser = vi.spyOn(api.bible, 'chooseBoundary').mockResolvedValue(0);
    openBiblePassage(passage, {verseNumbers: false});
    const id = useShow.getState().openItemId;
    if (id === null) throw Error('Missing Bible source');
    const view = render(
      <>
        <BibleSplitTools onProblem={vi.fn()} />
        <BiblePanel sizeClass="normal" />
      </>,
    );
    await waitFor(() =>
      expect(tilesOf(id).length).toBeGreaterThan(passage.verses.length),
    );
    const tiles = tilesOf(id);
    const element = previewSpec(
      screen.getAllByRole('option')[0],
    )?.appearance.theme.layout.elements.find(
      element => element.kind === 'currentText',
    );
    const verse = passage.verses[1];
    if (element === undefined || verse === undefined) {
      throw Error('Missing verse or preview element');
    }
    act(() =>
      bibleRefinements.put(
        {
          reference: {
            translation: passage.translation,
            book: 43,
            chapter: verse.chapter,
            verse: verse.verse,
          },
          text: verse.text,
        },
        element,
        {prefix: '', cuts: [1]},
      ),
    );
    expect(tilesOf(id)).toEqual(tiles);
    expect(status).not.toHaveBeenCalled();
    expect(chooser).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();
  });

  it('opens manual review on the rule-based parts without requesting AI', async () => {
    const layout = mockSplitLayout();
    vi.spyOn(bibleRendering, 'bibleMeasure').mockReturnValue(layout);
    const {edit} = setup();
    const api = window.llp;
    if (api === undefined) throw Error('Missing API');
    vi.spyOn(api.preferences, 'get').mockResolvedValue({
      ...defaultPreferences,
      bible: {...defaultPreferences.bible, splitEditorAutoOpen: false},
    });
    const status = vi.spyOn(api.bible, 'getLlmStatus').mockResolvedValue({
      status: 'ready',
      available: true,
      reason: '',
    });
    const chooser = vi.spyOn(api.bible, 'chooseBoundary').mockResolvedValue(0);
    const text = MOCK_LONG_VERSE.replace('작은', '밝은');
    openBiblePassage({
      ...passage,
      verses: [{chapter: 3, verse: 16, text}],
    });
    const id = useShow.getState().openItemId;
    if (id === null) throw Error('Missing Bible source');
    const view = render(<BibleSplitTools enableManual onProblem={vi.fn()} />);
    const expected = splitVerse(text, layout).chunks.map(chunk => chunk.lines);
    await waitFor(() =>
      expect(tilesOf(id).map(tile => tile.lines)).toEqual(expected),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () =>
      fireEvent.keyDown(document.body, {key: 'e', code: 'KeyE', ctrlKey: true}),
    );
    await screen.findByRole('dialog', {name: '절 나누기'});
    expect(tilesOf(id).map(tile => tile.lines)).toEqual(expected);
    expect(status).not.toHaveBeenCalled();
    expect(chooser).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
    view.unmount();
  });
  it.each([false, true])(
    'retains a continuation selection across a workspace round trip, respecting a new selection %s',
    async changedWhileAway => {
      const fixture = setup();
      openBiblePassage(passage);
      const view = render(<ShowShortcuts onProblem={vi.fn()} />);
      await waitFor(() => {
        const current = useShow.getState().openItemId;
        expect(current === null ? 0 : tilesOf(current).length).toBeGreaterThan(
          passage.verses.length,
        );
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      const id = useShow.getState().openItemId;
      if (id === null) throw Error('Missing source');
      const before = tilesOf(id);
      expect(before[1]).toMatchObject({label: '\uC6943:16 (2)', biblePart: 2});
      act(() => useShow.setState({selectedTile: 1}));
      view.rerender(<span>준비</span>);
      expect(tilesOf(id)).toHaveLength(passage.verses.length);
      if (changedWhileAway) act(() => useShow.setState({selectedTile: 1}));
      view.rerender(<ShowShortcuts onProblem={vi.fn()} />);
      await waitFor(() => expect(tilesOf(id).length).toBe(before.length));
      const index = changedWhileAway
        ? before.findIndex(tile => tile.label === '\uC6943:17')
        : 1;
      expect(useShow.getState().selectedTile).toBe(index);
      expect(tilesOf(id)[index]).toMatchObject({
        label: changedWhileAway ? '\uC6943:17' : '\uC6943:16 (2)',
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
        });
        useShow.setState({openItemId: sourceId});
      } else openBiblePassage(extended);
      const view = render(<BibleSplitTools enableManual onProblem={vi.fn()} />);
      await waitFor(() => {
        const current = useShow.getState().openItemId;
        expect(current === null ? 0 : tilesOf(current).length).toBeGreaterThan(
          passage.verses.length,
        );
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.keyDown(document.body, {key: 'e', code: 'KeyE', ctrlKey: true});
      await screen.findByRole('dialog');
      await act(async () =>
        fireEvent.click(screen.getByRole('button', {name: '\uD655\uC815'})),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const id = useShow.getState().openItemId;
      if (id === null) throw Error('Missing source');
      const before = tilesOf(id).findIndex(tile => tile.label === '\uC6943:17');
      act(() => outputTile({itemId: id, index: before}));
      const command = lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]);
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
      const cutsDocument = fixture.documents.get('bibleCuts');
      const api = window.llp;
      if (cutsDocument?.name !== 'bibleCuts' || api === undefined) {
        throw Error('Missing cuts API');
      }
      const cuts =
        cutsDocument.value.entries[passage.translation]?.['43:3:16']?.cuts;
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
        expect(tilesOf(id).findIndex(tile => tile.label === '\uC6943:17')).toBe(
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
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {label: '\uC6943:18', biblePart: 1},
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
    const command = lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]);
    expect(parseLiveCommand(command).ok).toBe(true);
    view.unmount();
  });
  it('outputs a requested passage immediately without a split dialog', async () => {
    const fixture = setup();
    openBiblePassage(passage, {verseNumbers: true, review: false});
    const view = render(<BibleSplitTools onProblem={vi.fn()} />);
    await waitFor(() => {
      const id = useShow.getState().openItemId;
      expect(id === null ? 0 : tilesOf(id).length).toBeGreaterThan(2);
    });
    act(() => showBiblePassage(passage));
    await waitFor(() => expect(fixture.send).toHaveBeenCalled());
    expect(screen.queryByRole('dialog', {name: '? ???'})).toBeNull();
    expect(
      fixture.send.mock.calls.flatMap(([command]) => liveCommands(command)),
    ).toContainEqual(expect.objectContaining({type: 'slide.show'}));
    view.unmount();
  });

  it.each(['saved', 'panel'] as const)(
    'manually confirms %s verse cuts and outputs the split part',
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
        });
        useShow.setState({openItemId: sourceId});
      } else openBiblePassage(passage);
      const view = render(<BibleSplitTools enableManual onProblem={vi.fn()} />);
      await waitFor(() => {
        const current = useShow.getState().openItemId;
        expect(current === null ? 0 : tilesOf(current).length).toBeGreaterThan(
          passage.verses.length,
        );
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.keyDown(document.body, {key: 'e', code: 'KeyE', ctrlKey: true});
      await screen.findByRole('dialog');
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
        .flatMap(([command]) => liveCommands(command))
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
        expect(
          lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
        ).toMatchObject({
          type: 'slide.show',
          slide: {position: last, continued: false},
        });
      }
      view.unmount();
    },
  );
});
