import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {emptyLiveState} from '@core/live/state';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {parseSlidesProjection} from '@core/schema/slidesProjection';
import {
  parseServiceDocument,
  type ServiceDocument,
} from '@core/schema/contentDocuments';
import {isItemOfKind} from '@core/schema/service';
import type {
  SettingsDocument,
  SettingsName,
} from '@core/schema/settingsDocuments';
import {createServiceId} from '@core/schema/ids';
import {projectSlides} from '@core/presentation/slides';
import type {SlidesItem} from '@core/services/slidesEdits';
import {SlidesEditorHarness} from '@fixtures/renderer/features/service/slides/slidesEditorHarness';
import {ControlSession} from '@renderer/app/controlSession';
import {ShowShortcuts} from '@renderer/app/workspaces/showPanels';
import {defaultPreferences} from '@core/schema/preferences';
import * as bibleRendering from '@renderer/rendering/bibleMeasure';
import {
  applyService,
  outputTile,
  tilesOf,
  useShow,
} from '@renderer/session/show';
import {noService} from '@renderer/session/showStore';
import {useLive} from '@renderer/session/live';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themeFile, THEME_MAIN} from '@fixtures/core/themeOutput';
import {mockSplitLayout, MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import {slidesItem, SLIDE_PICTURE} from '@fixtures/core/slides';
import {
  slidesBibleItem,
  slidesBiblePassages,
  SLIDES_PASSAGE,
  VERSE_REPEAT,
  VERSE_SLIDE,
} from '@fixtures/core/slidesBible';
import {SUNDAY_ID} from '@fixtures/main/store/testFiles';

vi.mock('@renderer/features/songs/editor/SongPreview', () => ({
  Picture: () => <div />,
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock('@renderer/rendering/bibleMeasure', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@renderer/rendering/bibleMeasure')
  >()),
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
}));

const serviceId = createServiceId(SUNDAY_ID);
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: new EventTarget(),
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useShow.setState({
    ...noService,
    openItemId: null,
    selectedTile: 0,
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    librarySong: null,
  });
  useLive.setState({
    state: emptyLiveState(),
    lastStartedItemId: null,
    commandVersion: 0,
  });
});
afterEach(() => {
  cleanup();
  delete window.llp;
  if (originalFonts === undefined) Reflect.deleteProperty(document, 'fonts');
  else Object.defineProperty(document, 'fonts', originalFonts);
});

function fixture(item: SlidesItem = slidesItem('blank'), longBoth = false) {
  const file = themeFile();
  const bibleTheme = file.defaults.bible;
  if (bibleTheme === undefined) throw Error('Missing theme');
  const themes = {
    ...file,
    defaults: {...file.defaults, blank: bibleTheme},
    themes: file.themes.map(theme => ({
      ...theme,
      screens: Object.fromEntries(
        Object.entries(theme.screens).map(([id, layout]) => [
          id,
          {
            ...layout,
            elements: layout.elements.map(element =>
              element.kind === 'currentText'
                ? {
                    ...element,
                    frame: {x: 0, y: 0, w: 300, h: 100},
                    text: {
                      ...element.text,
                      size: 36,
                      lineHeight: 1.25,
                      maxLines: 2,
                    },
                  }
                : element,
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
            id: SLIDES_PASSAGE.translation,
            name: 'Invented',
            lang: 'ko',
            file: 'sample.llbible',
            default: true,
          },
        ],
        recents: [],
      }),
    ],
  ]);
  const initial = parseServiceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Invented',
      date: '2026-11-06T11:00',
      order: [item],
    },
    revision: 1,
    access: 'editable',
  });
  if (!initial.ok || initial.value === null) {
    throw Error('Invalid service fixture');
  }
  let document: ServiceDocument = initial.value;
  const listeners = new Set<(document: SettingsDocument) => void>();
  const settingsEdit = vi.fn<LlpApi['settings']['edit']>(async request => {
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
  const content = vi.fn<LlpApi['content']['edit']>(async request => {
    if (request.type !== 'service.update') {
      throw Error('Unexpected content edit');
    }
    document = {
      ...document,
      service: request.service,
      revision: document.revision + 1,
    };
    return {ok: true, value: {id: serviceId, revision: document.revision}};
  });
  const send = vi.fn<LlpApi['live']['send']>(command => {
    const commands =
      command.type === 'live.batch' ? command.commands : [command];
    const shown = commands.findLast(value => value.type === 'slide.show');
    if (shown?.type === 'slide.show') {
      useLive.setState(value => ({
        state: {
          ...emptyLiveState(),
          ...value.state,
          layers: {...emptyLiveState().layers, slide: shown.slide},
        },
      }));
    }
  });
  const slidesProjection = vi.fn<LlpApi['service']['slidesProjection']>();
  const api = mockLlpApi({
    settings: {
      get: async request => {
        const value = documents.get(request.name);
        if (value === undefined) throw Error('Missing settings');
        return value;
      },
      edit: settingsEdit,
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    services: {get: async () => document},
    content: {edit: content},
    slidesEditor: {target: async () => ({serviceId, itemId: item.id})},
    service: {slidesProjection},
    media: {
      get: async () => ({
        name: 'media',
        revision: 1,
        access: 'editable',
        value: {
          format: 'llmedia',
          schemaVersion: 1,
          playlists: [],
          audioPlaylists: [],
          items: [
            {
              id: SLIDE_PICTURE,
              name: 'Invented picture',
              kind: 'image',
              file: 'poster.png',
              size: 1,
            },
          ],
        },
      }),
    },
    live: {send},
    bible: {
      lookup: async request => {
        const range = /3:(\d+)(?:-(\d+))?/.exec(request.input);
        const first = Number(range?.[1]);
        const last = Number(range?.[2] ?? range?.[1]);
        const verses = SLIDES_PASSAGE.verses
          .filter(verse => verse.verse >= first && verse.verse <= last)
          .map(verse => (longBoth ? {...verse, text: MOCK_LONG_VERSE} : verse));
        return {
          ...request,
          bounds: {
            bookId: 43,
            chapterVerses: Array.from({length: 21}, () => 40),
          },
          suggestions: [],
          result:
            verses.length === 0
              ? {
                  ok: false,
                  error: {code: 'syntax', message: '장을 확인해야 합니다'},
                }
              : {
                  ok: true,
                  value: {
                    ...SLIDES_PASSAGE,
                    ref: `요한복음 3:${first}${last === first ? '' : `-${last}`}`,
                    verses,
                  },
                },
        };
      },
    },
  });
  window.llp = api;
  return {
    api,
    item,
    documents,
    settingsEdit,
    content,
    send,
    slidesProjection,
    document: () => document,
  };
}

async function chooseRange(
  waitForCuts = true,
  beforeAdd: () => void = () => undefined,
) {
  fireEvent.click(await screen.findByRole('button', {name: '성경 구절 추가…'}));
  const dialog = await screen.findByRole('dialog', {name: '성경 구절'});
  const book = within(dialog).getByRole<HTMLInputElement>('combobox', {
    name: '책',
  });
  await waitFor(() => expect(book.disabled).toBe(false));
  fireEvent.change(book, {target: {value: '요한복음'}});
  for (const [name, value] of [
    ['장', '3'],
    ['시작절', '16'],
    ['끝절', '17'],
  ] as const) {
    const field = within(dialog).getByRole<HTMLInputElement>('textbox', {name});
    await waitFor(() => expect(field.disabled).toBe(false));
    fireEvent.change(field, {target: {value}});
  }
  const add = within(dialog).getByRole('button', {name: '추가'});
  await waitFor(() =>
    expect(add.getAttribute('aria-disabled')).not.toBe('true'),
  );
  beforeAdd();
  fireEvent.click(add);
  if (waitForCuts) await screen.findByRole('button', {name: 'A에서 자르기'});
  return screen.findByRole('dialog', {
    name: waitForCuts ? '절 나누기' : '성경 구절',
  });
}

it('inserts the range without review when automatic opening is off', async () => {
  const f = fixture(slidesItem('blank'), true);
  vi.spyOn(f.api.preferences, 'get').mockResolvedValue({
    ...defaultPreferences,
    bible: {...defaultPreferences.bible, splitEditorAutoOpen: false},
  });
  const session = new ControlSession(f.api);
  const view = render(<SlidesEditorHarness session={session} />);
  await screen.findByRole('button', {name: '성경 구절 추가…'});
  fireEvent.click(screen.getByRole('button', {name: '성경 구절 추가…'}));
  await screen.findByRole('dialog', {name: '성경 구절'});
  const fields = ['책', '장', '시작절', '끝절'];
  const values = ['요한복음', '3', '16', '17'];
  fields.forEach((label, i) =>
    fireEvent.change(screen.getByLabelText(label), {
      target: {value: values[i]},
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '추가'}).getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', {name: '추가'})),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.queryByRole('status', {name: 'AI 준비 중'})).toBeNull();
  view.unmount();
});

it('inserts the reviewed range after selection as one undo step, saves references only, and reopens cuts with Ctrl E', async () => {
  const f = fixture(slidesItem('blank'), true);
  const session = new ControlSession(f.api);
  const view = render(<SlidesEditorHarness session={session} />);
  try {
    const first = await chooseRange();
    expect(first.textContent).toContain('1 / 2');
    await act(async () =>
      fireEvent.click(within(first).getByRole('button', {name: '확정'})),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', {name: '절 나누기'}).textContent,
      ).toContain('2 / 2'),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole('button', {name: '확정'})),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-slide-id]')).toHaveLength(
        5,
      ),
    );
    const verseThumbnail = view.container.querySelector(
      '[data-slide-id] [data-measured-line]',
    );
    expect(verseThumbnail).not.toBeNull();
    expect(verseThumbnail?.parentElement?.style.fontSize).toBe('36px');
    expect(verseThumbnail?.closest('svg')?.getAttribute('viewBox')).toBe(
      '0 0 1920 1080',
    );
    await waitFor(() => expect(f.content).toHaveBeenCalledOnce());
    const selected = view.container.querySelector<HTMLElement>(
      '[data-selected=true][data-slide-id]',
    );
    if (selected === null) throw Error('Missing selected verse');
    await waitFor(() => expect(document.activeElement).toBe(selected));
    fireEvent.keyDown(selected, {code: 'KeyE', key: 'e', ctrlKey: true});
    await screen.findByRole('button', {name: 'A에서 자르기'});
    fireEvent.keyDown(screen.getByRole('dialog', {name: '절 나누기'}), {
      code: 'Escape',
      key: 'Escape',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(selected);
    await waitFor(() => expect(f.content).toHaveBeenCalledOnce());
    const item = f.document().service.order[0];
    if (item === undefined || !isItemOfKind(item, 'slides')) {
      throw Error('Missing saved slides');
    }
    expect(item.slides.slides[1]).toHaveProperty('verse.verse', 16);
    expect(item.slides.slides[2]).toHaveProperty('verse.verse', 17);
    expect(item.slides.slides[3]).toHaveProperty('media', SLIDE_PICTURE);
    expect(JSON.stringify(item)).not.toContain(MOCK_LONG_VERSE);
    fireEvent.keyDown(selected, {code: 'KeyZ', key: 'z', ctrlKey: true});
    expect(view.container.querySelectorAll('[data-slide-id]')).toHaveLength(3);
    fireEvent.keyDown(
      view.container.querySelector('[data-slide-id]') ?? document.body,
      {code: 'KeyY', key: 'y', ctrlKey: true},
    );
    expect(view.container.querySelectorAll('[data-slide-id]')).toHaveLength(5);
    expect(f.send).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    await session.dispose();
  }
});

it('cancels the pending insertion with Escape and keeps the original draft', async () => {
  const f = fixture();
  const session = new ControlSession(f.api);
  const view = render(<SlidesEditorHarness session={session} />);
  try {
    await chooseRange();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      code: 'Escape',
      key: 'Escape',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(view.container.querySelectorAll('[data-slide-id]')).toHaveLength(3);
    expect(screen.queryByRole('button', {name: '저장'})).toBeNull();
    expect(f.content).not.toHaveBeenCalled();
    expect(f.send).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    await session.dispose();
  }
});

it('discards a late lookup after cancelling the loading window', async () => {
  const f = fixture();
  const lookup = f.api.bible.lookup;
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const session = new ControlSession(f.api);
  const view = render(<SlidesEditorHarness session={session} />);
  try {
    const loading = await chooseRange(false, () => {
      vi.spyOn(f.api.bible, 'lookup').mockImplementation(async request => {
        if (request.input.endsWith('3:16')) await held;
        return lookup(request);
      });
    });
    expect(within(loading).getByRole('status').textContent).toBe('불러오는 중');
    fireEvent.keyDown(loading, {code: 'Escape', key: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => {
      release?.();
      await held;
    });
    expect(view.container.querySelectorAll('[data-slide-id]')).toHaveLength(3);
    expect(f.content).not.toHaveBeenCalled();
    expect(f.send).not.toHaveBeenCalled();
  } finally {
    release?.();
    view.unmount();
    await session.dispose();
  }
});

it.each([true, false])(
  'cancels before the first AI result with automatic opening %s and discards the late result',
  async autoOpen => {
    const f = fixture(slidesItem('blank'), true);
    vi.spyOn(bibleRendering, 'bibleMeasure').mockReturnValue(mockSplitLayout());
    vi.spyOn(f.api.preferences, 'get').mockResolvedValue({
      ...defaultPreferences,
      bible: {...defaultPreferences.bible, splitEditorAutoOpen: autoOpen},
    });
    vi.spyOn(f.api.bible, 'getLlmStatus').mockResolvedValue({
      status: 'ready',
      available: true,
      reason: '',
    });
    let release: (index: number) => void = () => undefined;
    const held = new Promise<number>(resolve => {
      release = resolve;
    });
    const chooser = vi
      .spyOn(f.api.bible, 'chooseBoundary')
      .mockReturnValue(held);
    const cancel = vi.spyOn(f.api.bible, 'cancelBoundary');
    const session = new ControlSession(f.api);
    const view = render(<SlidesEditorHarness session={session} />);
    try {
      await chooseRange(false);
      await waitFor(() => expect(chooser).toHaveBeenCalledOnce());
      const loading = screen.getByRole('dialog', {name: '성경 구절'});
      expect(within(loading).getByRole('status').textContent).toBe(
        '불러오는 중',
      );
      expect(
        within(loading)
          .getByRole('button', {name: '확정'})
          .getAttribute('aria-disabled'),
      ).toBe('true');
      expect(loading.contains(document.activeElement)).toBe(true);
      fireEvent.keyDown(document.activeElement ?? document.body, {
        code: 'Escape',
        key: 'Escape',
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(cancel).toHaveBeenCalledExactlyOnceWith({
        lookupId: chooser.mock.calls[0]?.[0].lookupId,
      });
      await act(async () => {
        release(0);
        await held;
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(chooser).toHaveBeenCalledOnce();
      expect(view.container.querySelectorAll('[data-slide-id]')).toHaveLength(
        3,
      );
      expect(screen.queryByRole('button', {name: '저장'})).toBeNull();
      expect(f.content).not.toHaveBeenCalled();
      expect(f.send).not.toHaveBeenCalled();
    } finally {
      release(0);
      view.unmount();
      await session.dispose();
    }
  },
);

it('presents mixed verse slots as parts and keeps repeated verses distinct in live navigation', async () => {
  const f = fixture(slidesBibleItem());
  applyService({
    id: serviceId,
    name: 'Invented',
    revision: 1,
    readOnly: false,
    rows: [
      {
        id: f.item.id,
        kind: 'slides',
        form: 'blank',
        title: f.item.slides.name,
        sourceRevision: 1,
      },
    ],
    tiles: {
      [f.item.id]: projectSlides(
        f.item,
        undefined,
        slidesBiblePassages(f.item),
      ),
    },
    jumpKeys: {},
  });
  useShow.setState({openItemId: f.item.id});
  const view = render(<ShowShortcuts onProblem={vi.fn()} />);
  try {
    await screen.findByRole('dialog', {name: '절 나누기'});
    await act(async () =>
      fireEvent.click(screen.getByRole('button', {name: '확정'})),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const tiles = tilesOf(f.item.id);
    const at = tiles.findIndex(tile => tile.sourceSlideId === VERSE_SLIDE);
    act(() => outputTile({itemId: f.item.id, index: at}));
    expect(useLive.getState().state?.layers.slide).toMatchObject({
      sourceSlideId: VERSE_SLIDE,
      biblePart: 1,
      continued: true,
      reference: '요한복음 3:16',
    });
    const batch = f.send.mock.calls.findIndex(
      ([value]) => value.type === 'live.batch',
    );
    expect(f.slidesProjection).toHaveBeenCalled();
    expect(f.slidesProjection.mock.invocationCallOrder[0]).toBeLessThan(
      f.send.mock.invocationCallOrder[batch] ?? 0,
    );
    expect(
      parseSlidesProjection(f.slidesProjection.mock.calls.at(-1)?.[0]).ok,
    ).toBe(true);
    expect(f.slidesProjection.mock.calls.at(-1)?.[0].measurement).toEqual({
      themes: f.documents.get('themes')?.revision,
      screens: f.documents.get('screens')?.revision,
      bibleCuts: f.documents.get('bibleCuts')?.revision,
    });
    const repeat = tiles.findIndex(tile => tile.sourceSlideId === VERSE_REPEAT);
    for (let index = at + 1; index <= repeat; index++) {
      fireEvent.keyDown(document.body, {code: 'ArrowRight', key: 'ArrowRight'});
      fireEvent.keyUp(document.body, {code: 'ArrowRight', key: 'ArrowRight'});
    }
    expect(useLive.getState().state?.layers.slide).toMatchObject({
      sourceSlideId: VERSE_REPEAT,
      biblePart: 1,
    });
    for (const [command] of f.send.mock.calls) {
      expect(parseLiveCommand(command).ok).toBe(true);
    }
  } finally {
    view.unmount();
  }
});
