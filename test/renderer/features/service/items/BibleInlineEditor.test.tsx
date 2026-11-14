import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, onTestFinished, vi} from 'vitest';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {createThemeId} from '@core/schema/ids';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
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
  await screen.findByRole('textbox', {name: '구역 이름'});
  const cardRow = (): HTMLElement => {
    const row = view.container.querySelector<HTMLElement>(
      '[data-leading-card]',
    );
    if (row === null) throw Error('Missing leading card');
    return row;
  };
  expect(within(cardRow()).getAllByText('1', {exact: true})).toHaveLength(1);
  const editorRegion = screen.getByRole('region', {
    name: '\uC131\uACBD \uD3B8\uC9D1',
  });
  const toolbar = within(editorRegion).getByRole('toolbar', {
    name: '\uC2AC\uB77C\uC774\uB4DC \uBCF4\uAE30',
  });
  expect(
    within(editorRegion).getAllByRole('toolbar', {
      name: '\uC2AC\uB77C\uC774\uB4DC \uBCF4\uAE30',
    }),
  ).toHaveLength(1);
  expect(editorRegion.querySelectorAll('footer')).toHaveLength(1);
  const footer = toolbar.closest('footer');
  expect(footer).not.toBeNull();
  expect(footer?.textContent).toContain('103\uAC1C');
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
  await userEvent.click(cardRow());
  await userEvent.keyboard('[ControlLeft>]');
  await userEvent.click(screen.getByText('First verse'));
  await userEvent.keyboard('[/ControlLeft]');
  expect(items.getSnapshot().bibleCardSelected).toBe(true);
  expect(items.getSnapshot().bibleSelection).toEqual([0]);
  await userEvent.keyboard('[ControlLeft>]');
  await userEvent.click(cardRow());
  await userEvent.keyboard('[/ControlLeft]');
  expect(items.getSnapshot().bibleCardSelected).toBe(false);
  await userEvent.click(cardRow());
  await userEvent.keyboard('[ShiftLeft>]');
  await userEvent.click(screen.getByText('Second verse'));
  await userEvent.keyboard('[/ShiftLeft]');
  expect(items.getSnapshot().bibleCardSelected).toBe(true);
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
