import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {textSlideKey, textVerseKey} from '@core/presentation/textOverrides';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {createThemeId} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {deleteBibleSlides} from '@renderer/features/service/items/deleteBibleSlides';
import {BibleInlineEditor} from '@renderer/features/service/items/BibleInlineEditor';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {useShow} from '@renderer/session/show';
import {seedSlideSurfaceView} from '@renderer/features/songs/editor/SlideSurfaceView';

vi.mock('@renderer/features/bible/useBibleProjections', () => ({
  useBibleTileProjection: () => null,
}));
vi.mock('@renderer/platform/useSlideTheme', () => ({
  useSlideTheme: () => undefined,
}));

it.each(['bible', 'sermon'] as const)(
  'deletes several %s slides through the shortcut and menu with shared undo',
  async kind => {
    seedSlideSurfaceView({});
    const fixture = itemFixture();
    const original = fixture.service();
    const lookup = panelPassage();
    const passage = {
      translation: lookup.translation,
      ref: lookup.ref,
      split: 'verse',
      reference: 'every',
      verseNumbers: false,
      translationName: false,
    } as const;
    const id = fixtureItems.arranged;
    const target = {serviceId: fixtureServiceId, itemId: id};
    const parsed = parseServiceDocument({
      ...original,
      service: {
        ...original.service,
        order: [
          kind === 'bible'
            ? {id, bible: passage}
            : {id, sermon: {title: 'Sermon', passage}},
        ],
      },
    });
    if (!parsed.ok || !parsed.value) throw Error('Missing service');
    fixture.pushService(parsed.value);
    const passageFromFile = () => {
      const item = fixture.service().service.order[0];
      if (!item) throw Error('Missing item');
      if (isItemOfKind(item, 'sermon')) return item.sermon.passage;
      if (isItemOfKind(item, 'bible')) return item.bible;
      throw Error('Missing passage');
    };
    const previous = useShow.getState();
    const tiles = bibleVerseTiles(lookup, passage);
    const deleted = [tiles[0], tiles[2]].map(tile => {
      if (!tile) throw Error('Missing tile');
      return textSlideKey(tile);
    });
    const publish = () => {
      const stored = passageFromFile();
      useShow.setState({
        serviceId: fixtureServiceId,
        openItemId: id,
        rows: [
          {
            id,
            kind: 'bible',
            title: lookup.ref,
            bible: {...stored, passage: lookup},
          },
        ],
        tiles: {[id]: bibleVerseTiles(lookup, stored)},
      });
    };
    publish();
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    items.show(target);
    const view = render(
      <BibleInlineEditor items={items} ui={fixture.api.ui} onBack={vi.fn()} />,
    );
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      await editor.dispose();
      useShow.setState(previous);
    });
    const user = userEvent.setup();
    const select = async () => {
      await user.click(await screen.findByText('Invented verse 16'));
      await user.keyboard('[ControlLeft>]');
      await user.click(screen.getByText('Invented verse 18'));
      await user.keyboard('[/ControlLeft]');
      expect(items.getSnapshot().bibleSelection).toEqual([0, 2]);
    };
    await select();
    await user.keyboard('{Delete}');
    await waitFor(() =>
      expect(passageFromFile().deletedSlides).toEqual(deleted),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(passageFromFile().ref).toBe(lookup.ref);
    act(publish);
    expect(screen.queryByText('Invented verse 16')).toBeNull();
    expect(screen.getByText('Invented verse 17')).toBeDefined();
    await act(() => items.replayItemEdit('undo'));
    act(publish);
    expect(passageFromFile().deletedSlides).toBeUndefined();
    expect(screen.getByText('Invented verse 16')).toBeDefined();
    await act(() => items.replayItemEdit('redo'));
    expect(passageFromFile().deletedSlides).toEqual(deleted);
    await act(() => items.replayItemEdit('undo'));
    act(publish);
    await select();
    fireEvent.contextMenu(screen.getByText('Invented verse 18'));
    await user.click(await screen.findByRole('menuitem', {name: /^2개 삭제/u}));
    await waitFor(() =>
      expect(passageFromFile().deletedSlides).toEqual(deleted),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      items.show(null);
    });
    act(publish);
    act(() => {
      items.show(target);
    });
    await screen.findByText('Invented verse 17');
    expect(screen.queryByText('Invented verse 16')).toBeNull();
    expect(screen.queryByText('Invented verse 18')).toBeNull();
    expect(passageFromFile().ref).toBe(passage.ref);
  },
);

it('shows an editable card and read-only Bible verses in both views', async () => {
  seedSlideSurfaceView({});
  const fixture = itemFixture();
  const current = fixture.service();
  const card = {
    name: 'Section',
    english: 'English',
    theme: createThemeId('00000000-0000-4000-8000-000000000111'),
  };
  const parsed = parseServiceDocument({
    ...current,
    service: {
      ...current.service,
      order: [
        {
          id: fixtureItems.arranged,
          sectionCard: card,
          bible: {
            translation: 'sample',
            ref: 'John 3:16-17',
            split: 'verse',
            reference: 'every',
            verseNumbers: true,
            translationName: false,
          },
        },
      ],
    },
  });
  if (!parsed.ok || parsed.value === null) throw Error('invalid fixture');
  fixture.pushService(parsed.value);
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: fixtureItems.arranged,
    tiles: {
      [fixtureItems.arranged]: [
        {label: '3:16', labelColor: 'none', lines: ['First verse']},
        {label: '3:17', labelColor: 'none', lines: ['Second verse']},
        ...Array.from({length: 100}, (_, index) => ({
          label: `4:${index + 1}`,
          labelColor: 'none' as const,
          lines: [`Extra verse ${index}`],
        })),
      ],
    },
  });
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  const view = render(
    <BibleInlineEditor items={items} ui={fixture.api.ui} onBack={vi.fn()} />,
  );
  onTestFinished(async () => {
    seedSlideSurfaceView({});
    view.unmount();
    items.dispose();
    useShow.setState({serviceId: null, openItemId: null, tiles: {}});
    await editor.dispose();
  });
  await screen.findByRole('textbox', {name: '타이틀'});
  const cardRow = (): HTMLElement => {
    const row = view.container.querySelector<HTMLElement>(
      '[data-leading-card]',
    );
    if (row === null) throw Error('Missing leading card');
    return row;
  };
  expect(within(cardRow()).getAllByText('1', {exact: true})).toHaveLength(1);
  const editorRegion = screen.getByRole('region', {
    name: '성경 편집',
  });
  const toolbar = within(editorRegion).getByRole('toolbar', {
    name: '슬라이드 보기',
  });
  expect(
    within(editorRegion).getAllByRole('toolbar', {
      name: '슬라이드 보기',
    }),
  ).toHaveLength(1);
  expect(editorRegion.querySelectorAll('footer')).toHaveLength(1);
  const footer = toolbar.closest('footer');
  expect(footer).not.toBeNull();
  expect(footer?.textContent).toContain('103개');
  expect(within(toolbar).queryByRole('spinbutton')).toBeNull();
  expect(screen.getByText('First verse')).toBeDefined();
  expect(screen.queryByText('Extra verse 99')).toBeNull();
  expect(screen.getAllByRole('option')[0]?.getAttribute('aria-readonly')).toBe(
    'true',
  );
  expect(screen.getAllByRole('textbox')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', {name: '격자'}));
  expect(within(cardRow()).getAllByText('1', {exact: true})).toHaveLength(1);
  expect(within(toolbar).getByRole('spinbutton')).toBeDefined();
  expect(screen.getByText('Second verse')).toBeDefined();
  expect(screen.getAllByRole('textbox')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', {name: '목록'}));
  expect(within(toolbar).queryByRole('spinbutton')).toBeNull();
  await waitFor(() => expect(screen.getByText('First verse')).toBeDefined());
  const selectionUser = userEvent.setup();
  await selectionUser.click(cardRow());
  await selectionUser.keyboard('[ControlLeft>]');
  await selectionUser.click(screen.getByText('First verse'));
  await selectionUser.keyboard('[/ControlLeft]');
  expect(items.getSnapshot().cardSelected).toBe(true);
  expect(items.getSnapshot().bibleSelection).toEqual([0]);
  await selectionUser.keyboard('[ControlLeft>]');
  await selectionUser.click(cardRow());
  await selectionUser.keyboard('[/ControlLeft]');
  expect(items.getSnapshot().cardSelected).toBe(false);
  await selectionUser.click(cardRow());
  await selectionUser.keyboard('[ShiftLeft>]');
  await selectionUser.click(screen.getByText('Second verse'));
  await selectionUser.keyboard('[/ShiftLeft]');
  expect(items.getSnapshot().cardSelected).toBe(true);
  expect(items.getSnapshot().bibleSelection).toEqual([0, 1]);
  await userEvent.click(screen.getByText('First verse'));
  await userEvent.keyboard('{ArrowLeft}{Delete}');
  await waitFor(() =>
    expect(items.getSnapshot().item).not.toHaveProperty('sectionCard'),
  );
  await userEvent.click(screen.getByText('First verse'));
  await userEvent.keyboard('{Delete}');
  expect(screen.getByText('First verse')).toBeDefined();
});

it.each(['list', 'grid'] as const)(
  'positions measured card and multiline verses in %s',
  async mode => {
    seedSlideSurfaceView({
      layout: {normal: {editorSlideView: mode, editorSlideScalePercent: 200}},
    });
    const width = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(600);
    const measure = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const isCard =
          this.matches('[data-leading-card]') ||
          this.querySelector('[data-leading-card]') !== null;
        const verse = this.querySelector<HTMLElement>('[data-slide-index]');
        const height = isCard
          ? 180
          : verse?.dataset['slideIndex'] === '0'
            ? 260
            : verse?.dataset['slideIndex'] === '1'
              ? 140
              : 0;
        return DOMRect.fromRect({width: 300, height});
      });
    const fixture = itemFixture();
    const current = fixture.service();
    const parsed = parseServiceDocument({
      ...current,
      service: {
        ...current.service,
        order: [
          {
            id: fixtureItems.arranged,
            sectionCard: {
              name: 'Section',
              english: 'English',
              theme: '00000000-0000-4000-8000-000000000111',
            },
            bible: {
              translation: 'sample',
              ref: 'John 3:16-17',
              split: 'verse',
              reference: 'every',
              verseNumbers: true,
              translationName: false,
            },
          },
        ],
      },
    });
    if (!parsed.ok || parsed.value === null) throw Error('invalid fixture');
    fixture.pushService(parsed.value);
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    useShow.setState({
      serviceId: fixtureServiceId,
      openItemId: fixtureItems.arranged,
      tiles: {
        [fixtureItems.arranged]: [
          {
            label: '3:16',
            labelColor: 'none',
            lines: ['First', 'Second', 'Third'],
          },
          {label: '3:17', labelColor: 'none', lines: ['Next']},
        ],
      },
    });
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    const view = render(
      <BibleInlineEditor items={items} ui={fixture.api.ui} onBack={vi.fn()} />,
    );
    try {
      await screen.findByText(/First/);
      await waitFor(() => {
        const first = view.container
          .querySelector('[data-slide-index="0"]')
          ?.closest<HTMLElement>('[data-measured-row]');
        const second = view.container
          .querySelector('[data-slide-index="1"]')
          ?.closest<HTMLElement>('[data-measured-row]');
        expect(first?.style.top).toBe(mode === 'list' ? '180px' : '0px');
        expect(second?.style.top).toBe(mode === 'list' ? '440px' : '260px');
      });
    } finally {
      view.unmount();
      items.dispose();
      await editor.dispose();
      measure.mockRestore();
      width.mockRestore();
      seedSlideSurfaceView({});
      useShow.setState({serviceId: null, openItemId: null, tiles: {}});
    }
  },
);

it('deletes a pinned fallback part using the installed verse before measurement', async () => {
  const lookup = panelPassage();
  const verse = bibleVerseTiles(lookup)[0]?.bibleVerse;
  if (verse === undefined) throw Error('Missing verse');
  const pinnedVerses = {[textVerseKey(verse)]: ['Invented ', 'verse 16']};
  const fixture = itemFixture();
  const original = fixture.service();
  const id = fixtureItems.arranged;
  const parsed = parseServiceDocument({
    ...original,
    service: {
      ...original.service,
      order: [
        {
          id,
          bible: {
            translation: lookup.translation,
            ref: lookup.ref,
            split: 'verse',
            reference: 'every',
            verseNumbers: false,
            translationName: false,
            pinnedVerses,
          },
        },
      ],
    },
  });
  const item = parsed.ok ? parsed.value?.service.order[0] : undefined;
  if (
    !parsed.ok ||
    parsed.value === null ||
    item === undefined ||
    !isItemOfKind(item, 'bible')
  ) {
    throw Error('Missing Bible item');
  }
  fixture.pushService(parsed.value);
  const tile = bibleVerseTiles(lookup, item.bible)[1];
  if (tile?.biblePart !== 2) throw Error('Missing fallback part');
  const previous = useShow.getState();
  useShow.setState({
    serviceId: fixtureServiceId,
    rows: [
      {
        id,
        kind: 'bible',
        title: lookup.ref,
        bible: {...item.bible, passage: lookup},
      },
    ],
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  onTestFinished(async () => {
    items.dispose();
    await editor.dispose();
    useShow.setState(previous);
  });
  items.show({serviceId: fixtureServiceId, itemId: id});
  const deleted = await deleteBibleSlides({
    items,
    serviceId: fixtureServiceId,
    item,
    tiles: [tile],
    projection: null,
    removeCard: false,
  });
  expect(deleted).toBe(true);
  expect(fixture.service().service.order[0]).toMatchObject({
    bible: {pinnedVerses, deletedSlides: [textSlideKey(tile)]},
  });
});
