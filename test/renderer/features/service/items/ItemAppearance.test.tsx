import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
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
import {checkPart} from '@core/schema/fileFormat';
import {biblePassageSchema} from '@core/schema/biblePassage';
import {createDefaultThemes} from '@core/themes/defaults';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import type {Theme} from '@core/schema/themes';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {mockMenuRowHeight} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {useShow} from '@renderer/session/show';
import {MEDIA_DRAG_MIME} from '@renderer/features/media/mediaDrag';
import {ItemSlideGrid} from '@renderer/features/service/items/ItemSlideGrid';
import {ItemSettingsPanel} from '@renderer/features/service/items/ItemSidePanels';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';

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
  slideCount = 3,
) {
  mockMenuRowHeight();
  const fixture = itemFixture();
  const document = fixture.service();
  fixture.pushService({
    ...document,
    service: {
      ...document.service,
      order: document.service.order.map(row =>
        row.id === fixtureItems.arranged
          ? {
              ...row,
              slides: Array.from({length: slideCount}, (_, index) => ({
                id: fixtureSlideId(index + 1),
                lines: [`Item slide ${index + 1}`],
              })),
            }
          : row,
      ),
    },
  });

  const read = fixture.api.settings.get;
  vi.spyOn(fixture.api.settings, 'get').mockImplementation(request => {
    if (request.name === 'themes') {
      return Promise.resolve(settingsDocument('themes', themeFile));
    }
    if (request.name === 'screens') {
      return Promise.resolve(settingsDocument('screens', {screens}));
    }
    return read(request);
  });
  window.llp = fixture.api;
  const openWindow = vi
    .spyOn(fixture.api.window, 'openSongEditor')
    .mockResolvedValue({ok: true, value: undefined});
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const problem = vi.fn();
  const items = new ServiceItemStore(fixture.api, editor, problem);
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  const navigate = vi.fn();
  const view = render(
    <WorkspaceNavigation.Provider value={navigate}>
      <ItemSlideGrid items={items} editor={editor} />
      <ItemSettingsPanel items={items} editor={editor} />
    </WorkspaceNavigation.Provider>,
  );
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  await waitFor(() => expect(slides().length).toBeGreaterThanOrEqual(3));
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '테마'}).getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  return {
    ...fixture,
    openWindow,
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

function slides(): HTMLElement[] {
  return screen.queryAllByRole('option');
}

function slide(position: number): HTMLElement {
  const found = slides()[position - 1];
  if (found === undefined) throw new Error(`No slide ${position}`);
  return found;
}

type Session = Awaited<ReturnType<typeof setup>>;

/** Adds an 오버레이 with text from the right-click menu of a slide. */
async function addOverlay(
  user: Session['user'],
  position: number,
  text = '',
): Promise<void> {
  fireEvent.contextMenu(slide(position));
  await user.click(
    await screen.findByRole('menuitem', {name: '오버레이 추가…'}),
  );
  if (text !== '') {
    await user.type(screen.getByRole('textbox', {name: '오버레이 글자'}), text);
  }
  await user.click(screen.getByRole('button', {name: '적용'}));
}

function bar(name: RegExp | string) {
  return screen.getByRole('button', {name});
}

function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  target: Element,
  point: {clientX: number; clientY: number} = {clientX: 0, clientY: 0},
): void {
  fireEvent(target, new MouseEvent(type, {bubbles: true, ...point}));
}

/** Lays the slides out two to a row, 100px apart, as the grid would. */
function layOutSlides(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const index = slides().findIndex(option => option === this);
      return index < 0
        ? new DOMRect()
        : new DOMRect((index % 2) * 100, Math.floor(index / 2) * 80, 90, 60);
    },
  );
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
}

it('warns about an overlay without a theme element and clears the warning for a suitable theme', async () => {
  const {user} = await setup();
  await addOverlay(user, 1);
  const warning = await screen.findByRole('img', {
    name: '무대 화면 화면에 오버레이 요소 없음',
  });
  expect(warning).toBeDefined();
  expect(screen.getAllByRole('button', {name: '테마 편집…'})).toHaveLength(2);
  await user.click(screen.getByRole('button', {name: '테마'}));
  await user.click(screen.getByRole('menuitemradio', {name: '특송'}));
  await waitFor(() =>
    expect(screen.queryByRole('img', {name: /오버레이 요소 없음/})).toBeNull(),
  );
});

it('adds from the slide menu to the song end, and edits the range in the popover with a tooltip on overlap', async () => {
  const {user, stored, edits} = await setup();
  const total = slides().length;
  await addOverlay(user, 2);
  await waitFor(() =>
    expect(stored()?.overlays?.[0]).toMatchObject({
      from: fixtureSlideId(2),
      to: fixtureSlideId(total),
      screens: [SCREEN],
      content: {text: ''},
    }),
  );
  await user.click(bar(`오버레이 1, 슬라이드 2부터 ${total}까지`));
  const to = screen.getByRole('spinbutton', {name: '끝 슬라이드'});
  fireEvent.change(to, {target: {value: '3'}});
  fireEvent.blur(to);
  await waitFor(() =>
    expect(stored()?.overlays?.[0]?.to).toBe(fixtureSlideId(3)),
  );
  await addOverlay(user, 1);
  await waitFor(() => expect(stored()?.overlays).toHaveLength(2));
  expect(stored()?.overlays?.[1]).toMatchObject({
    from: fixtureSlideId(1),
    to: fixtureSlideId(1),
  });
  await user.click(bar('오버레이 2, 슬라이드 1부터 1까지'));
  const before = edits.length;
  const secondTo = screen.getByRole('spinbutton', {name: '끝 슬라이드'});
  fireEvent.change(secondTo, {target: {value: '2'}});
  fireEvent.blur(secondTo);
  expect(stored()?.overlays?.[1]?.to).toBe(fixtureSlideId(1));
  expect(edits).toHaveLength(before);
  expect((await hoverForTooltip(secondTo))?.textContent).toContain(
    '다른 오버레이와 겹칩니다',
  );
});

it('offers 오버레이 바꾸기… and 삭제 on a slide that has one, and 추가… on one that does not', async () => {
  const {user, stored} = await setup();
  await addOverlay(user, 2);
  await waitFor(() => expect(stored()?.overlays).toHaveLength(1));
  fireEvent.contextMenu(slide(1));
  expect(
    await screen.findByRole('menuitem', {name: '오버레이 추가…'}),
  ).toBeDefined();
  await user.keyboard('{Escape}');
  fireEvent.contextMenu(slide(2));
  expect(
    await screen.findByRole('menuitem', {name: '오버레이 바꾸기…'}),
  ).toBeDefined();
  expect(screen.queryByRole('menuitem', {name: '오버레이 추가…'})).toBeNull();
  await user.click(screen.getByRole('menuitem', {name: '오버레이 삭제'}));
  await waitFor(() => expect(stored()).not.toHaveProperty('overlays'));
});

it('removes the chosen clip with Delete', async () => {
  const {user, stored} = await setup();
  await addOverlay(user, 1);
  await waitFor(() => expect(stored()?.overlays).toHaveLength(1));
  await user.click(bar(/^오버레이 1,/));
  await user.keyboard('{Delete}');
  await waitFor(() => expect(stored()).not.toHaveProperty('overlays'));
});

it('puts a dropped media file on a slide as a new overlay, and replaces the media of one that has it keeping the choices', async () => {
  const {user, stored} = await setup();
  const total = slides().length;
  const drop = (media: string, position: number): void => {
    fireEvent.drop(slide(position), {
      dataTransfer: {
        types: [MEDIA_DRAG_MIME],
        getData: () => media,
        dropEffect: 'none',
      },
    });
  };
  drop(fixtureMedia.dawn, 2);
  await waitFor(() =>
    expect(stored()?.overlays?.[0]).toMatchObject({
      from: fixtureSlideId(2),
      to: fixtureSlideId(total),
      content: {media: fixtureMedia.dawn, loop: false, sound: false},
    }),
  );
  await user.click(bar(/, 슬라이드 2부터/));
  await user.click(screen.getByRole('checkbox', {name: '소리'}));
  await waitFor(() =>
    expect(stored()?.overlays?.[0]?.content).toMatchObject({sound: true}),
  );
  drop(fixtureMedia.warm, 3);
  await waitFor(() =>
    expect(stored()?.overlays?.[0]).toMatchObject({
      from: fixtureSlideId(2),
      to: fixtureSlideId(total),
      content: {media: fixtureMedia.warm, sound: true},
    }),
  );
  expect(stored()?.overlays).toHaveLength(1);
});

it('stores text or video content and the video loop and sound choices', async () => {
  const {user, stored} = await setup();
  await addOverlay(user, 1);
  await user.click(await screen.findByRole('button', {name: /^오버레이 1,/}));
  await user.click(screen.getByRole('button', {name: '바꾸기…'}));
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
    within(screen.getByRole('dialog', {name: '오버레이 내용'})).getByRole(
      'radio',
      {name: '미디어'},
    ),
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

it('refuses invalid overlay arrays through the service writer and disables the add item at the cap', async () => {
  const {items, stored, edits, user} = await setup(undefined, 60);
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
  fireEvent.contextMenu(slide(1));
  const add = await screen.findByRole('menuitem', {name: '오버레이 추가…'});
  expect(add.getAttribute('aria-disabled')).toBe('true');
  await user.keyboard('{Escape}');
  expect(stored()?.overlays).toHaveLength(50);
  expect(edits).toHaveLength(1);
});

it('keeps slide selection local and exposes the shared source slide menu', async () => {
  const {user, items, openWindow, edits} = await setup();
  slide(2).focus();
  await user.keyboard('{ArrowRight}');
  expect(items.getSnapshot().position).toBe(2);
  expect(edits).toHaveLength(0);
  fireEvent.contextMenu(slide(2));
  await user.click(
    screen.getByRole('menuitem', {name: windowCommandLabels.editSong}),
  );
  expect(openWindow).toHaveBeenCalledOnce();
});

it('locks the theme and overlay edits when the service becomes read-only', async () => {
  const {user, service, pushService, edits} = await setup();
  await addOverlay(user, 1);
  await user.click(await screen.findByRole('button', {name: /^오버레이 1,/}));
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
  expect(screen.getByRole('spinbutton', {name: '끝 슬라이드'})).toHaveProperty(
    'readOnly',
    true,
  );
  const before = edits.length;
  await user.click(screen.getByRole('button', {name: '오버레이 삭제'}));
  expect(edits).toHaveLength(before);
  fireEvent.contextMenu(slide(2));
  expect(
    (
      await screen.findByRole('menuitem', {name: '오버레이 바꾸기…'})
    ).getAttribute('aria-disabled'),
  ).toBe('true');
});

it('keeps a failed content draft available for retry', async () => {
  const {user, api, stored} = await setup();
  fireEvent.contextMenu(slide(1));
  await user.click(
    await screen.findByRole('menuitem', {name: '오버레이 추가…'}),
  );
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

it('draws one bar for each row of slides with › where it runs on, and drags an end to another slide', async () => {
  layOutSlides();
  const {items, stored} = await setup();
  await act(async () => {
    await items.changeOverlays(() => [
      {
        id: createItemOverlayId('90000000-0000-4000-8000-000000000030'),
        name: 'First',
        from: 2,
        to: 2,
        screens: [],
        content: {text: ''},
      },
    ]);
  });
  const handle = (edge: string): Element => {
    const found = document.querySelector(`[data-edge="${edge}"]`);
    if (found === null) throw new Error(`No ${edge} handle`);
    return found;
  };
  const end = handle('to');
  pointer('pointerdown', end);
  pointer('pointermove', document.body, {clientX: 100, clientY: 20});
  pointer('pointermove', document.body, {clientX: 45, clientY: 100});
  pointer('pointerup', document.body);
  await waitFor(() =>
    expect(stored()?.overlays?.[0]).toMatchObject({
      from: fixtureSlideId(2),
      to: fixtureSlideId(3),
    }),
  );
  expect(document.querySelectorAll('[data-overlay-clip] button')).toHaveLength(
    2,
  );
  expect(screen.getByText('›')).toBeDefined();
  expect(screen.getByText('‹')).toBeDefined();
  const start = handle('from');
  pointer('pointerdown', start);
  pointer('pointermove', document.body, {clientX: 5, clientY: 10});
  pointer('pointerup', document.body);
  await waitFor(() =>
    expect(stored()?.overlays?.[0]).toMatchObject({
      from: fixtureSlideId(1),
      to: fixtureSlideId(3),
    }),
  );
});

it('confirms deletion in the popover and clears the last overlay', async () => {
  const {user, stored} = await setup();
  await addOverlay(user, 1);
  await user.click(await screen.findByRole('button', {name: /^오버레이 1,/}));
  await user.click(screen.getByRole('button', {name: '오버레이 삭제'}));
  const dialog = screen.getByRole('alertdialog');
  expect(stored()?.overlays).toHaveLength(1);
  await user.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(stored()?.overlays).toHaveLength(1);
  await user.click(screen.getByRole('button', {name: '오버레이 삭제'}));
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {name: '삭제'}),
  );
  await waitFor(() => expect(stored()).not.toHaveProperty('overlays'));
});

it.each(['bible', 'media'] as const)(
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
      kind === 'media' ? {media: fixtureMedia.warm} : {bible: passage.value};
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

it('offers the built-in default when the saved default theme is gone', async () => {
  const {user, stored} = await setup({...defaults, themes: [special]});
  await user.click(screen.getByRole('button', {name: '테마'}));
  await user.click(screen.getByRole('menuitemradio', {name: '특송'}));
  await waitFor(() => expect(stored()?.theme).toBe(SPECIAL));
  await user.click(screen.getByRole('button', {name: '테마'}));
  await user.click(screen.getByRole('menuitemradio', {name: /찬양/}));
  await waitFor(() => expect(stored()).not.toHaveProperty('theme'));
});
