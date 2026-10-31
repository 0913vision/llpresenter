import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, onTestFinished, vi} from 'vitest';
import {
  createScreenId,
  createThemeId,
  createThemeElementId,
  createItemOverlayId,
} from '@core/schema/ids';
import {createNoticeSetId} from '@core/schema/ids';
import {checkPart} from '@core/schema/fileFormat';
import {biblePassageSchema} from '@core/schema/biblePassage';
import {isGroupedSong} from '@core/schema/groupedSong';
import {createDefaultThemes} from '@core/themes/defaults';
import {settingsDocument} from '@core/testing/settingsDocument';
import type {Theme} from '@core/schema/themes';
import {fixtureMedia} from '@core/testing/mediaList';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {mockMenuRowHeight} from '@renderer/features/songs/editor/editorTesting';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {useShow} from '@renderer/session/show';
import {commitDraftBeforeShortcut} from '@renderer/ui/commitDraft';
import {ItemOverlayTable} from './ItemOverlayTable';
import {ItemSettingsPanel} from './ItemSidePanels';
import {ServiceItemStore} from './serviceItemStore';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const SCREEN = createScreenId('90000000-0000-4000-8000-000000000001');
const SPECIAL = createThemeId('90000000-0000-4000-8000-000000000002');
const screens = [
  {id: SCREEN, name: '무대 화면', kind: 'stage', method: 'window'},
] as const;
const defaults = createDefaultThemes(screens);
const special: Theme = {
  id: SPECIAL,
  name: '특송',
  screens: {
    [SCREEN]: {
      mode: {kind: 'own'},
      elements: [
        {
          id: createThemeElementId('90000000-0000-4000-8000-000000000003'),
          kind: 'overlay',
          frame: {x: 0, y: 0, w: 1920, h: 1080},
          fit: 'fit',
        },
      ],
    },
  },
};

afterEach(() => {
  cleanup();
  resetTooltips();
  delete window.llp;
  useShow.setState({serviceId: null, openItemId: null});
});

async function setup(
  themeFile = {...defaults, themes: [...defaults.themes, special]},
) {
  mockMenuRowHeight();
  const fixture = itemFixture();
  const read = fixture.api.settings.get;
  vi.spyOn(fixture.api.settings, 'get').mockImplementation(request => {
    if (request.name === 'themes') {
      return Promise.resolve(settingsDocument('themes', themeFile));
    }
    if (request.name === 'screens') {
      return Promise.resolve(settingsDocument('screens', {screens}));
    }
    if (request.name === 'notices') {
      return Promise.resolve(settingsDocument('notices', {sets: []}));
    }
    return read(request);
  });
  window.llp = fixture.api;
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const problem = vi.fn();
  const items = new ServiceItemStore(fixture.api, editor, problem);
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  const navigate = vi.fn();
  const view = render(
    <WorkspaceNavigation.Provider value={navigate}>
      <ItemOverlayTable items={items} editor={editor} />
      <ItemSettingsPanel items={items} editor={editor} />
    </WorkspaceNavigation.Provider>,
  );
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  await screen.findByRole('button', {name: '슬라이드 3'});
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '테마'}).getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  return {
    ...fixture,
    items,
    editor,
    problem,
    navigate,
    user: userEvent.setup(),
    stored: () =>
      fixture
        .service()
        .service.order.find(row => row.id === fixtureItems.arranged),
  };
}

it('stores a chosen theme, follows its kind default again, and opens the theme workspace', async () => {
  const {user, stored, navigate} = await setup();
  await user.click(screen.getByRole('button', {name: '테마'}));
  await user.click(screen.getByRole('menuitemradio', {name: '특송'}));
  await waitFor(() => expect(stored()?.theme).toBe(SPECIAL));
  expect(stored()).toMatchObject({memo: '천천히', future: {keep: true}});
  await user.click(screen.getByRole('button', {name: '테마 편집…'}));
  expect(navigate).toHaveBeenCalledWith('screens');
  await user.click(screen.getByRole('button', {name: '테마'}));
  await user.click(screen.getByRole('menuitemradio', {name: /찬양/}));
  await waitFor(() => expect(stored()).not.toHaveProperty('theme'));
});

it('adds at the selected slide, edits its inclusive range, and refuses overlap with a tooltip', async () => {
  const {user, stored, edits} = await setup();
  await user.click(screen.getByRole('button', {name: '슬라이드 2'}));
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  await waitFor(() =>
    expect(stored()?.overlays?.[0]).toMatchObject({
      from: 2,
      to: 2,
      screens: [SCREEN],
      content: {text: ''},
    }),
  );
  const to = screen.getByRole('spinbutton', {name: '끝 슬라이드'});
  fireEvent.change(to, {target: {value: '3'}});
  fireEvent.blur(to);
  await waitFor(() => expect(stored()?.overlays?.[0]?.to).toBe(3));
  expect(
    screen.getAllByRole('button', {name: '오버레이 1, 슬라이드 2부터 3까지'}),
  ).toHaveLength(2);
  await user.click(screen.getByRole('button', {name: '슬라이드 1'}));
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  await waitFor(() => expect(stored()?.overlays).toHaveLength(2));
  const before = edits.length;
  const secondTo = screen.getByRole('spinbutton', {name: '끝 슬라이드'});
  fireEvent.change(secondTo, {target: {value: '2'}});
  fireEvent.blur(secondTo);
  expect(stored()?.overlays?.[1]?.to).toBe(1);
  expect(edits).toHaveLength(before);
  expect((await hoverForTooltip(secondTo))?.textContent).toContain(
    '다른 오버레이와 슬라이드 범위가 겹칩니다',
  );
});

it('warns about an overlay without a theme element and clears the warning for a suitable theme', async () => {
  const {user} = await setup();
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  const warning = await screen.findByRole('img', {
    name: '오버레이 요소가 없는 화면: 무대 화면',
  });
  expect(warning).toBeDefined();
  expect(screen.getAllByRole('button', {name: '테마 편집…'})).toHaveLength(2);
  await user.click(screen.getByRole('button', {name: '테마'}));
  await user.click(screen.getByRole('menuitemradio', {name: '특송'}));
  await waitFor(() =>
    expect(
      screen.queryByRole('img', {name: /오버레이 요소가 없는 화면/}),
    ).toBeNull(),
  );
});

it('stores text or video content and the video loop and sound choices', async () => {
  const {user, stored} = await setup();
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  await user.click(await screen.findByRole('button', {name: '바꾸기…'}));
  await user.type(
    screen.getByRole('textbox', {name: '오버레이 글자'}),
    'Invented caption',
  );
  await user.click(screen.getByRole('button', {name: '적용'}));
  await waitFor(() =>
    expect(stored()?.overlays?.[0]?.content).toEqual({
      text: 'Invented caption',
    }),
  );
  await user.click(screen.getByRole('button', {name: '바꾸기…'}));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('radio', {name: '미디어'}),
  );
  await user.click(screen.getByRole('button', {name: '오버레이 미디어'}));
  await user.click(screen.getByRole('option', {name: '새벽 하늘'}));
  await user.click(screen.getByRole('button', {name: '적용'}));
  await waitFor(() =>
    expect(stored()?.overlays?.[0]?.content).toMatchObject({
      media: fixtureMedia.dawn,
      loop: false,
      sound: false,
    }),
  );
  await user.click(screen.getByRole('radio', {name: '반복'}));
  await waitFor(() =>
    expect(stored()?.overlays?.[0]?.content).toMatchObject({loop: true}),
  );
  await user.click(screen.getByRole('checkbox', {name: '소리'}));
  await waitFor(() =>
    expect(stored()?.overlays?.[0]?.content).toMatchObject({sound: true}),
  );
});

it('refuses invalid overlay arrays through the service writer and enforces the add cap', async () => {
  const {items, stored, edits, user} = await setup();
  await act(async () => {
    expect(
      await items.changeOverlays(() => [
        {
          id: createItemOverlayId('90000000-0000-4000-8000-000000000011'),
          name: 'Invalid',
          from: 3,
          to: 1,
          screens: [],
          content: {text: ''},
        },
      ]),
    ).toBe(false);
  });
  expect(stored()?.overlays).toBeUndefined();
  expect(edits).toHaveLength(0);
  await act(async () => {
    await items.changeOverlays(() =>
      Array.from({length: 50}, (_, index) => ({
        id: createItemOverlayId(
          `90000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
        ),
        name: `Overlay ${index}`,
        from: index + 10,
        to: index + 10,
        screens: [],
        content: {text: ''},
      })),
    );
  });
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  expect(stored()?.overlays).toHaveLength(50);
  expect(edits).toHaveLength(1);
});

it('keeps table selection local and exposes the shared source slide menu', async () => {
  const {user, items, editor, edits} = await setup();
  const second = screen.getByRole('button', {name: '슬라이드 2'});
  second.focus();
  await user.keyboard('{ArrowDown}');
  expect(items.getSnapshot().position).toBe(2);
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: '슬라이드 3'}),
  );
  expect(edits).toHaveLength(0);
  fireEvent.contextMenu(screen.getByRole('button', {name: '슬라이드 2'}));
  await user.click(screen.getByRole('menuitem', {name: '곡 편집'}));
  expect(editor.getSnapshot().session).not.toBeNull();
});

it.each(['bible', 'notice', 'media'] as const)(
  'stores a theme for a %s item without changing its source',
  async kind => {
    const {user, service, pushService, stored} = await setup();
    const passage = checkPart(biblePassageSchema, {
      translation: 'invented',
      ref: 'John 1:1',
      split: 'verse',
      reference: 'every',
      verseNumbers: true,
      translationName: false,
    });
    if (!passage.ok) throw new Error('Invalid Bible fixture');
    const source =
      kind === 'media'
        ? {media: fixtureMedia.warm}
        : kind === 'notice'
          ? {notice: createNoticeSetId('90000000-0000-4000-8000-000000000020')}
          : {bible: passage.value};
    const document = service();
    act(() =>
      pushService({
        ...document,
        revision: document.revision + 1,
        service: {
          ...document.service,
          order: document.service.order.map(row =>
            row.id === fixtureItems.arranged ? {id: row.id, ...source} : row,
          ),
        },
      }),
    );
    await user.click(screen.getByRole('button', {name: '테마'}));
    await user.click(screen.getByRole('menuitemradio', {name: '특송'}));
    await waitFor(() =>
      expect(stored()).toMatchObject({...source, theme: SPECIAL}),
    );
  },
);

it('locks the theme and overlay edits when the service becomes read-only', async () => {
  const {user, service, pushService, edits} = await setup();
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  await screen.findByRole('textbox', {name: '이름'});
  const document = service();
  act(() =>
    pushService({
      ...document,
      revision: document.revision + 1,
      access: 'readOnly',
    }),
  );
  expect(
    screen.getByRole('button', {name: '테마'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
    'readOnly',
    true,
  );
  const before = edits.length;
  await user.click(screen.getByRole('button', {name: '오버레이 삭제'}));
  expect(edits).toHaveLength(before);
});

it('keeps a failed content draft available for retry', async () => {
  const {user, api, stored} = await setup();
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  await user.click(await screen.findByRole('button', {name: '바꾸기…'}));
  await user.type(
    screen.getByRole('textbox', {name: '오버레이 글자'}),
    'Keep this draft',
  );
  vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
    ok: false,
    error: {reason: 'stale', message: 'Changed'},
  });
  await user.click(screen.getByRole('button', {name: '적용'}));
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '적용'}).getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  expect(screen.getByRole('textbox', {name: '오버레이 글자'})).toHaveProperty(
    'value',
    'Keep this draft',
  );
  await user.click(screen.getByRole('button', {name: '적용'}));
  await waitFor(() =>
    expect(stored()?.overlays?.[0]?.content).toEqual({text: 'Keep this draft'}),
  );
});

async function setupLongSequence() {
  const fixture = await setup();
  const {first, pushSong} = fixture;
  if (!isGroupedSong(first.song)) throw new Error('Expected grouped fixture');
  const song = {
    ...first.song,
    groups: first.song.groups.map((group, index) =>
      index === 0
        ? {
            ...group,
            slides: Array.from({length: 40}, () => ({
              lines: ['Invented line'],
            })),
          }
        : group,
    ),
  };
  act(() => pushSong({...first, revision: first.revision + 1, song}));
  const table = screen.getByRole('table', {name: '슬라이드와 오버레이'});
  await waitFor(() =>
    expect(Number(table.getAttribute('aria-rowcount'))).toBeGreaterThan(40),
  );
  return {...fixture, table};
}

it('windows a long sequence and reveals the last row by keyboard', async () => {
  const {user, table} = await setupLongSequence();
  expect(
    within(table).getAllByRole('button', {name: /^슬라이드 \d+$/}).length,
  ).toBeLessThanOrEqual(12);
  screen.getByRole('button', {name: '슬라이드 1'}).focus();
  await user.keyboard('{End}');
  const last = Number(table.getAttribute('aria-rowcount')) - 1;
  expect(document.activeElement).toBe(
    screen.getByRole('button', {name: `슬라이드 ${last}`}),
  );
});

it('keeps manual scrolling away from the selected slide until the selection changes', async () => {
  class MockResizeObserver implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    disconnect = vi.fn();
    unobserve = vi.fn();
    observe(target: Element): void {
      const height = target.getAttribute('role') === 'rowgroup' ? 300 : 100;
      this.callback(
        [
          {
            target,
            contentRect: new DOMRect(0, 0, 500, height),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this,
      );
    }
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  const {items, user, table} = await setupLongSequence();
  const viewport = within(table).getByRole('rowgroup');
  Object.defineProperty(viewport, 'clientHeight', {value: 300});
  expect(items.getSnapshot().position).toBe(0);
  fireEvent.scroll(viewport, {target: {scrollTop: 2000}});
  expect(viewport.scrollTop).toBe(2000);
  expect(within(table).queryByRole('button', {name: '슬라이드 1'})).toBeNull();
  const visible = within(table).getByRole('button', {name: '슬라이드 21'});
  visible.focus();
  await user.keyboard('{ArrowDown}');
  expect(items.getSnapshot().position).toBe(21);
  expect(document.activeElement).toBe(
    within(table).getByRole('button', {name: '슬라이드 22'}),
  );
  await user.keyboard('{Home}');
  expect(viewport.scrollTop).toBe(0);
  expect(document.activeElement).toBe(
    within(table).getByRole('button', {name: '슬라이드 1'}),
  );
});

it('offers the built-in default when the saved default theme is gone', async () => {
  const {user, stored} = await setup({...defaults, themes: [special]});
  await user.click(screen.getByRole('button', {name: '테마'}));
  await user.click(screen.getByRole('menuitemradio', {name: '특송'}));
  await waitFor(() => expect(stored()?.theme).toBe(SPECIAL));
  await user.click(screen.getByRole('button', {name: '테마'}));
  await user.click(screen.getByRole('menuitemradio', {name: /찬양/}));
  await waitFor(() => expect(stored()).not.toHaveProperty('theme'));
});

it('confirms deletion and clears the last overlay and its selection', async () => {
  const {user, items, stored} = await setup();
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  await user.click(await screen.findByRole('button', {name: '오버레이 삭제'}));
  const dialog = screen.getByRole('alertdialog');
  expect(stored()?.overlays).toHaveLength(1);
  await user.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(stored()?.overlays).toHaveLength(1);
  await user.click(screen.getByRole('button', {name: '오버레이 삭제'}));
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {name: '삭제'}),
  );
  await waitFor(() => expect(stored()).not.toHaveProperty('overlays'));
  expect(items.getSnapshot().overlay).toBeNull();
});

it('moves a complete range past another overlay without saving invalid intermediate endpoints', async () => {
  const {items, stored, edits} = await setup();
  const first = createItemOverlayId('90000000-0000-4000-8000-000000000030');
  const second = createItemOverlayId('90000000-0000-4000-8000-000000000031');
  await act(async () => {
    await items.changeOverlays(() => [
      {
        id: first,
        name: 'First',
        from: 1,
        to: 1,
        screens: [],
        content: {text: ''},
      },
      {
        id: second,
        name: 'Second',
        from: 2,
        to: 2,
        screens: [],
        content: {text: ''},
      },
    ]);
    items.selectOverlay(first);
  });
  const before = edits.length;
  const from = screen.getByRole('spinbutton', {name: '시작 슬라이드'});
  fireEvent.change(from, {target: {value: '3'}});
  fireEvent.blur(from);
  expect(edits).toHaveLength(before);
  expect(from).toHaveProperty('value', '3');
  const to = screen.getByRole('spinbutton', {name: '끝 슬라이드'});
  fireEvent.change(to, {target: {value: '3'}});
  fireEvent.blur(to);
  await waitFor(() =>
    expect(stored()?.overlays?.[0]).toMatchObject({from: 3, to: 3}),
  );
  expect(stored()?.overlays?.[1]).toMatchObject({from: 2, to: 2});
});

it('commits a name draft before a global command and pins a departing draft to its original item', async () => {
  const {user, items, stored, service} = await setup();
  await user.click(screen.getByRole('button', {name: '오버레이 추가'}));
  const input = await screen.findByRole('textbox', {name: '이름'});
  await user.clear(input);
  await user.type(input, 'First name');
  act(() => commitDraftBeforeShortcut(input));
  await waitFor(() => expect(stored()?.overlays?.[0]?.name).toBe('First name'));
  await user.clear(input);
  await user.type(input, 'Departing name');
  act(() =>
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain}),
  );
  await waitFor(() =>
    expect(stored()?.overlays?.[0]?.name).toBe('Departing name'),
  );
  expect(
    service().service.order.find(row => row.id === fixtureItems.plain),
  ).not.toHaveProperty('overlays');
});
