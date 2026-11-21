import {useSyncExternalStore} from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {HistoryButtons} from '@renderer/app/shell/HistoryButtons';
import {isItemOfKind} from '@core/schema/service';
import {projectSlides} from '@core/presentation/slides';
import {slidesItem} from '@fixtures/core/slides';
import {
  THEME_MAIN,
  THEME_STAGE,
  liveThemeTextElements,
  themeElementBase,
  themeFile,
  themeScreens,
} from '@fixtures/core/themeOutput';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  fixtureServiceId,
  fixtureItems,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {
  SlideTextEditor,
  SlideTextFields,
} from '@renderer/features/service/items/SlideTextFields';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {useShow} from '@renderer/session/show';
import {BibleInlineEditor} from '@renderer/features/service/items/BibleInlineEditor';
import {seedSlideSurfaceView} from '@renderer/features/songs/editor/SlideSurfaceView';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {mockSplitLayout} from '@fixtures/core/bibleSplit';
import {
  projectBible,
  type BibleProjection,
} from '@renderer/features/bible/splitProjection';
import {createMediaId, createThemeId} from '@core/schema/ids';
import {parseServiceDocument} from '@core/schema/contentDocuments';

const bible = vi.hoisted((): {projection: BibleProjection | null} => ({
  projection: null,
}));
vi.mock('@renderer/features/bible/useBibleProjections', () => ({
  useBibleTileProjection: () => bible.projection,
}));

function installSettings(file = themeFile()) {
  const original = window.llp;
  window.llp = mockLlpApi({
    settings: {
      get: async request => {
        if (request.name === 'themes') {
          return settingsDocument('themes', file, 1);
        }
        if (request.name === 'screens') {
          return settingsDocument(
            'screens',
            {
              format: 'llsettings.screens',
              schemaVersion: 1,
              screens: themeScreens,
            },
            1,
          );
        }
        return settingsDocument(
          'timers',
          {format: 'llsettings.timers', schemaVersion: 1, timers: []},
          1,
        );
      },
    },
  });
  onTestFinished(() => {
    if (original === undefined) delete window.llp;
    else window.llp = original;
  });
}

it('keeps a manual blank and explicitly restores the automatic text', async () => {
  installSettings();
  const fixture = itemFixture();
  const item = slidesItem('ad');
  const first = item.slides.slides[0];
  if (!first) throw Error('Missing slide');
  const before = fixture.service();
  fixture.pushService({...before, service: {...before.service, order: [item]}});
  const previous = useShow.getState();
  useShow.setState({
    serviceId: fixtureServiceId,
    openItemId: item.id,
    rows: [{id: item.id, kind: 'slides', form: 'ad', title: item.slides.name}],
    tiles: {[item.id]: projectSlides(item)},
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  function Harness() {
    const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
    return <SlideTextFields items={items} state={state} />;
  }
  items.show({serviceId: fixtureServiceId, itemId: item.id});
  const view = render(<Harness />);
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
    useShow.setState(previous);
  });
  const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
    name: '슬라이드 이름',
  });
  expect(field.value).toBe('Meeting');
  const override = () =>
    Object.values(
      fixture.service().service.order[0]?.textOverrides?.[
        `slide:${first.id}`
      ] ?? {},
    )[0];
  await userEvent.click(field);
  fireEvent.change(field, {target: {value: 'Changed'}});
  await userEvent.tab();
  await waitFor(() =>
    expect(override()).toMatchObject({
      mode: 'manual',
      role: 'slideName',
      text: 'Changed',
    }),
  );
  await userEvent.click(field);
  fireEvent.change(field, {target: {value: ''}});
  await userEvent.tab();
  await waitFor(() =>
    expect(override()).toMatchObject({mode: 'manual', text: ''}),
  );
  expect(field.value).toBe('');
  await userEvent.click(
    screen.getByRole('button', {name: '슬라이드 이름 자동 값으로 복원'}),
  );
  await waitFor(() => expect(field.value).toBe('Meeting'));
  expect(fixture.service().service.order[0]?.textOverrides).toEqual({});
});

it.each(['bible', 'sermon'] as const)(
  '%s rows and the selected-slide panel share each slide edit across both views',
  async kind => {
    installSettings();
    seedSlideSurfaceView({});
    const fixture = itemFixture();
    const before = fixture.service();
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
    const result = parseServiceDocument({
      ...before,
      service: {
        ...before.service,
        order: [
          kind === 'bible'
            ? {id, bible: passage}
            : {id, sermon: {title: 'Sermon title', passage}},
        ],
      },
    });
    if (!result.ok || !result.value) throw Error('Missing test service');
    fixture.pushService(result.value);
    const projection = projectBible(
      {
        id,
        kind: 'bible',
        source: 'service',
        passage: lookup,
        verseNumbers: false,
        translationName: false,
        reference: 'every',
        ...(kind === 'sermon' ? {sermonTitle: 'Sermon title'} : {}),
      },
      {
        element: {...themeElementBase(), kind: 'currentText'},
        layout: mockSplitLayout(),
      },
    );
    if (!projection) throw Error('Missing fixture projection');
    bible.projection = projection;
    const previous = useShow.getState();
    useShow.setState({
      serviceId: fixtureServiceId,
      openItemId: id,
      rows: [
        {
          id,
          kind: 'bible',
          title: kind === 'sermon' ? 'Sermon title' : lookup.ref,
        },
      ],
      tiles: {[id]: projection.tiles},
    });
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    function Harness() {
      const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
      return (
        <>
          <HistoryButtons />
          <SlideTextEditor items={items} state={state}>
            {renderTextFields => (
              <BibleInlineEditor
                items={items}
                ui={fixture.api.ui}
                onBack={vi.fn()}
                renderTextFields={renderTextFields}
              />
            )}
          </SlideTextEditor>
          <aside aria-label="슬라이드 속성">
            <SlideTextFields items={items} state={state} />
          </aside>
        </>
      );
    }
    items.show({serviceId: fixtureServiceId, itemId: id});
    const view = render(<Harness />);
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      await editor.dispose();
      seedSlideSurfaceView({});
      useShow.setState(previous);
      bible.projection = null;
    });
    const zone = within(await screen.findByRole('region', {name: '성경 편집'}));
    const panel = within(
      screen.getByRole('complementary', {name: '슬라이드 속성'}),
    );
    const body = {name: '현재 슬라이드 글'};
    const rows = await zone.findAllByRole<HTMLTextAreaElement>('textbox', body);
    if (kind === 'sermon') {
      const opening = within(zone.getByRole('group', {name: '1번 슬라이드'}));
      expect(
        opening.getByRole<HTMLTextAreaElement>('textbox', {name: '성경 출처'})
          .value,
      ).toBe(lookup.displayRef);
      expect(
        opening.getByRole<HTMLTextAreaElement>('textbox', {name: '항목 이름'})
          .value,
      ).toBe(lookup.displayRef);
      expect(projection.tiles[0]?.textSlideKey).toBe('sermon:opening');
      expect(projection.tiles.at(-1)?.textSlideKey).toBe('sermon:closing');
    }
    expect(rows.map(row => row.value)).toContain('Invented verse 17');
    const verse = rows.find(row => row.value === 'Invented verse 17');
    if (!verse) throw Error('Missing verse field');
    const user = userEvent.setup();
    const savedItem = () => fixture.service().service.order[0];
    const pins = () => {
      const item = savedItem();
      if (item && isItemOfKind(item, 'bible')) return item.bible.pinnedVerses;
      if (item && isItemOfKind(item, 'sermon')) {
        return item.sermon.passage.pinnedVerses;
      }
      throw Error('Missing Bible or sermon item');
    };
    const original = savedItem();
    const verseRow = verse.closest<HTMLElement>('[data-slide-index]');
    if (verseRow === null) throw Error('Missing verse row');
    const reference = within(verseRow).getByRole<HTMLTextAreaElement>(
      'textbox',
      {name: '성경 출처'},
    );
    const autoReference = reference.value;
    const undo = screen.getByRole('button', {name: '실행 취소'});
    const redo = screen.getByRole('button', {name: '다시 실행'});
    await user.click(reference);
    fireEvent.change(reference, {target: {value: 'Edited reference'}});
    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => expect(redo.getAttribute('aria-disabled')).toBeNull());
    expect(savedItem()).toEqual(original);
    expect(reference.value).toBe(autoReference);
    await user.click(redo);
    await waitFor(() => expect(reference.value).toBe('Edited reference'));
    expect(pins()).toBeUndefined();
    const withReference = savedItem();

    await user.click(verse);
    fireEvent.change(verse, {target: {value: 'Row edit'}});
    await user.tab();
    await waitFor(() =>
      expect(panel.getByRole<HTMLTextAreaElement>('textbox', body).value).toBe(
        'Row edit',
      ),
    );
    const withPinnedBody = savedItem();
    expect(pins()).toBeDefined();
    await user.click(verse);
    await user.click(undo);
    await waitFor(() => expect(savedItem()).toEqual(withReference));
    expect(pins()).toBeUndefined();
    expect(reference.value).toBe('Edited reference');
    await user.keyboard('{Control>}y{/Control}');
    await waitFor(() => expect(savedItem()).toEqual(withPinnedBody));
    expect(pins()).toBeDefined();
    await user.click(zone.getByRole('button', {name: '격자'}));
    expect(zone.queryAllByRole('textbox')).toHaveLength(0);
    const sideField = panel.getByRole<HTMLTextAreaElement>('textbox', body);
    await user.click(sideField);
    fireEvent.change(sideField, {target: {value: 'Side edit'}});
    await user.tab();
    await user.click(zone.getByRole('button', {name: '목록'}));
    await waitFor(() =>
      expect(
        zone
          .getAllByRole<HTMLTextAreaElement>('textbox', body)
          .map(row => row.value),
      ).toContain('Side edit'),
    );
    expect(
      zone
        .getAllByRole<HTMLTextAreaElement>('textbox', body)
        .map(row => row.value),
    ).toContain('Invented verse 16');
  },
);

it.each(['song', 'media', 'ad'] as const)(
  'edits a %s tile using the theme selected by its Show row or item',
  async kind => {
    const theme = createThemeId('00000000-0000-4000-8000-000000005102');
    const file = themeFile();
    const liveElements = liveThemeTextElements();
    const stageLabel = {
      ...themeElementBase(141),
      kind: 'label',
      hideWhenItemTitle: true,
    } as const;
    installSettings({
      ...file,
      themes: [
        ...file.themes,
        {
          id: theme,
          name: 'Fixture theme',
          screens: {
            [THEME_STAGE]: {
              mode: {kind: 'own'},
              elements: [stageLabel, ...liveElements],
            },
            [THEME_MAIN]: {
              mode: {kind: 'own'},
              elements: [
                {
                  ...themeElementBase(),
                  kind: 'text',
                  content: 'Automatic fixture caption',
                  textSlot: {
                    slotId: 'caption',
                    name: 'Fixture caption',
                    role: 'text',
                    scope: 'screen',
                  },
                },
              ],
            },
          },
        },
      ],
    });
    const fixture = itemFixture();
    const before = fixture.service();
    const id = fixtureItems.arranged;
    const media = createMediaId('00000000-0000-4000-8000-000000005103');
    const ad = slidesItem('ad');
    const first = fixture.first.song.slides[0];
    if (first === undefined) throw Error('Missing fixture slide');
    const adSlide = ad.slides.slides[0];
    if (adSlide === undefined) throw Error('Missing fixture ad slide');
    const slideKey =
      kind === 'media'
        ? 'media:standalone'
        : `slide:${kind === 'ad' ? adSlide.id : first.id}`;
    const oldValues = {
      ...Object.fromEntries(
        liveElements.map(element => [
          [theme, THEME_STAGE, element.id].join('/'),
          'Old live text',
        ]),
      ),
      label: 'Old role cue',
      [[theme, THEME_STAGE, stageLabel.id].join('/')]: 'Old stage cue',
    };
    const textOverrides = {[slideKey]: oldValues};
    const result = parseServiceDocument({
      ...before,
      service: {
        ...before.service,
        order: [
          kind === 'song'
            ? {id, song: fixture.first.song.id, slides: [first], textOverrides}
            : kind === 'media'
              ? {id, media, theme, textOverrides}
              : {...ad, id, theme, textOverrides},
        ],
      },
    });
    if (!result.ok || result.value === null) {
      throw Error('Missing fixture service');
    }
    fixture.pushService(result.value);
    const previous = useShow.getState();
    useShow.setState({
      serviceId: fixtureServiceId,
      openItemId: id,
      rows: [
        kind === 'ad'
          ? {id, kind: 'slides', form: 'ad', title: 'Fixture item'}
          : {id, kind, title: 'Fixture item', theme},
      ],
      tiles: {
        [id]:
          kind === 'ad'
            ? projectSlides({...ad, id, textOverrides})
            : [
                {
                  label: null,
                  labelColor: 'none',
                  lines: ['Fixture item'],
                  textOverrides: oldValues,
                  ...(kind === 'song'
                    ? {
                        sourceSlide: {
                          songId: fixture.first.song.id,
                          slideId: first.id,
                        },
                      }
                    : {media: {mediaId: media, loop: false, itemId: id}}),
                },
              ],
      },
    });
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    function Harness() {
      const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
      return (
        <>
          <section aria-label="Slide row">
            <SlideTextEditor items={items} state={state}>
              {renderTextFields => renderTextFields(0)}
            </SlideTextEditor>
          </section>
          <section aria-label="Side panel">
            <SlideTextFields items={items} state={state} />
          </section>
        </>
      );
    }
    items.show({serviceId: fixtureServiceId, itemId: id});
    const view = render(<Harness />);
    onTestFinished(async () => {
      view.unmount();
      items.dispose();
      await editor.dispose();
      useShow.setState(previous);
    });
    const row = screen.getByRole('region', {name: 'Slide row'});
    const side = screen.getByRole('region', {name: 'Side panel'});
    const field = await within(side).findByRole<HTMLTextAreaElement>(
      'textbox',
      {
        name: /Fixture caption/,
      },
    );
    await within(row).findByRole('textbox', {name: /Fixture caption/});
    for (const element of [stageLabel, ...liveElements]) {
      expect(
        row.querySelector(`[data-slide-text-role="${element.kind}"]`),
      ).toBeNull();
      expect(
        side.querySelector(`[data-slide-text-role="${element.kind}"]`),
      ).toBeNull();
    }
    expect(screen.queryByText('Old live text')).toBeNull();
    expect(screen.queryByText('Old role cue')).toBeNull();
    expect(screen.queryByText('Old stage cue')).toBeNull();
    expect(field.value).toBe('Automatic fixture caption');
    fireEvent.change(field, {target: {value: 'Edited fixture caption'}});
    fireEvent.blur(field);
    await waitFor(() =>
      expect(
        fixture.service().service.order[0]?.textOverrides?.[slideKey],
      ).toMatchObject({
        ...oldValues,
        [`${theme}/${THEME_MAIN}/caption`]: {
          sourceThemeId: theme,
          text: 'Edited fixture caption',
        },
      }),
    );
  },
);
