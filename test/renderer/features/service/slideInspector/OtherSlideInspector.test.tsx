import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {
  createServiceItemId,
  createThemeId,
  translationIdSchema,
} from '@core/schema/ids';
import {parse} from 'valibot';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {OtherSlideInspector} from '@renderer/features/service/slideInspector/OtherSlideInspector';

vi.mock('@renderer/session/show', () => ({useShow: () => []}));
vi.mock('@renderer/features/bible/useBibleProjections', () => ({
  useBibleTileProjection: ({itemId}: {itemId: string | null}) =>
    itemId === null
      ? null
      : {
          tiles: [
            {label: '1:1', labelColor: 'none', lines: ['첫 말씀']},
            {label: '1:2', labelColor: 'none', lines: ['둘째 말씀']},
          ],
          partsByTile: [null, null],
          appearance: {theme: {layout: {}, emptyColor: '#000', item: null}},
        },
}));
vi.mock('@renderer/rendering/SlidePicture', () => ({
  SlidePicture: ({slide}: {slide: {label: string; sectionCard?: unknown}}) => (
    <div
      data-testid={
        slide.sectionCard === undefined ? 'bible-picture' : 'card-picture'
      }
    >
      {slide.label}
    </div>
  ),
}));
vi.mock('@renderer/platform/useSlideTheme', () => ({
  useSlideTheme: (item: unknown) =>
    item === undefined
      ? undefined
      : {layout: {}, emptyColor: '#000', item: null},
}));
vi.mock('@renderer/features/media/MediaPropertiesPanel', () => ({
  MediaProperties: ({item}: {item: {kind: string}}) => (
    <div>media settings {item.kind}</div>
  ),
}));

async function setup(
  kind: 'image' | 'video' | 'bible' | 'bible-card' | 'slide-card',
) {
  const fixture = itemFixture();
  const old = fixture.service();
  const itemId = createServiceItemId('50000000-0000-4000-8000-000000000099');
  const item =
    kind === 'bible' || kind === 'bible-card'
      ? {
          id: itemId,
          ...(kind === 'bible-card'
            ? {
                sectionCard: {
                  name: '예배 시작',
                  english: 'WELCOME',
                  theme: createThemeId('00000000-0000-4000-8000-000000000100'),
                },
              }
            : {}),
          bible: {
            translation: parse(translationIdSchema, 'sample'),
            ref: '창세기 1:1',
            split: 'verse' as const,
            reference: 'every' as const,
            verseNumbers: true,
            translationName: false,
          },
        }
      : kind === 'slide-card'
        ? {
            id: itemId,
            sectionCard: {
              name: '예배 시작',
              english: 'WELCOME',
              theme: createThemeId('00000000-0000-4000-8000-000000000100'),
            },
            slides: {form: 'blank' as const, name: 'Section', slides: []},
          }
        : {
            id: itemId,
            media: kind === 'image' ? fixtureMedia.warm : fixtureMedia.dawn,
          };
  fixture.pushService({
    ...old,
    revision: old.revision + 1,
    service: {...old.service, order: [item]},
  });
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  act(() => items.show({serviceId: fixtureServiceId, itemId}));
  const view = render(<OtherSlideInspector items={items} editor={editor} />);
  await waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
  return {view, items, editor};
}
it('shows the card-only slide item in the inspector', async () => {
  const {view, items, editor} = await setup('slide-card');
  expect(screen.getByTestId('card-picture').textContent).toBe('예배 시작');
  expect(screen.getByText('1 / 1')).toBeTruthy();
  view.unmount();
  items.dispose();
  await editor.dispose();
});
it.each(['image', 'video'] as const)(
  'shows the %s picture and existing media properties',
  async kind => {
    const {view, items, editor} = await setup(kind);
    await screen.findByText(`media settings ${kind}`);
    expect(view.container.querySelector('img')?.getAttribute('src')).toContain(
      fixtureMedia[kind === 'image' ? 'warm' : 'dawn'],
    );
    if (kind === 'video') {
      expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
        thumbnailSrc(fixtureMedia.dawn),
      );
    }
    const image = view.container.querySelector('img');
    if (image === null) throw new Error('Missing media picture');
    fireEvent.error(image);
    expect(image.style.visibility).toBe('hidden');
    fireEvent.load(image);
    expect(image.style.visibility).toBe('');
    view.unmount();
    items.dispose();
    await editor.dispose();
  },
);
it('shows only the selected Bible picture and label, with no transition row', async () => {
  const {view, items, editor} = await setup('bible');
  expect(screen.getByTestId('bible-picture')).toBeTruthy();
  expect(screen.getAllByText('1:1')).toHaveLength(2);
  expect(screen.queryByText('전환')).toBeNull();
  act(() => items.show(null));
  expect(screen.queryByTestId('bible-picture')).toBeNull();
  expect(screen.queryByText('1:1')).toBeNull();
  view.unmount();
  items.dispose();
  await editor.dispose();
});

it('shows the Bible opening card and offsets verse positions past it', async () => {
  const {view, items, editor} = await setup('bible-card');
  expect(screen.getByTestId('card-picture').textContent).toBe('예배 시작');
  expect(screen.getByText('1 / 3')).toBeTruthy();
  expect(screen.queryByTestId('bible-picture')).toBeNull();
  act(() => items.selectPosition(1));
  expect(screen.getByTestId('bible-picture').textContent).toBe('1:1');
  expect(screen.queryByTestId('card-picture')).toBeNull();
  act(() => items.selectPosition(2));
  expect(screen.getByTestId('bible-picture').textContent).toBe('1:2');
  view.unmount();
  items.dispose();
  await editor.dispose();
});
