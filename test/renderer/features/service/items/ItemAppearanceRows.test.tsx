import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {slidesItem} from '@fixtures/core/slides';
import {ids, templateOrder, otherItems} from '@fixtures/core/serviceList';
import {isItemOfKind} from '@core/schema/service';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {
  ItemAppearanceRows,
  type ItemAppearanceAdapter,
} from '@renderer/features/service/details/ItemAppearanceRows';

const rows = vi.hoisted(() => ({theme: vi.fn(), background: vi.fn()}));
vi.mock('@renderer/features/service/details/ItemThemeRow', () => ({
  ItemThemeRow: (props: {
    item: unknown;
    reason: string | undefined;
    setTheme?: (value: undefined, file: null) => void;
  }) => {
    rows.theme(props);
    return (
      <button
        disabled={props.reason !== undefined}
        onClick={() => props.setTheme?.(undefined, null)}
      >
        theme
      </button>
    );
  },
}));
vi.mock('@renderer/features/service/details/ItemSettingsRows', () => ({
  ItemBackgroundRow: (props: {
    item: unknown;
    lockReason: string | undefined;
    setBackground?: (value: 'none') => void;
  }) => {
    rows.background(props);
    return (
      <button
        disabled={props.lockReason !== undefined}
        onClick={() => props.setBackground?.('none')}
      >
        background
      </button>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const bible = templateOrder.find(item => isItemOfKind(item, 'bible'));
if (bible === undefined || !isItemOfKind(bible, 'bible')) {
  throw new Error('Missing Bible fixture');
}
const media = otherItems.find(item => isItemOfKind(item, 'media'));
if (media === undefined || !isItemOfKind(media, 'media')) {
  throw new Error('Missing media fixture');
}
const cases: ReadonlyArray<[string, ItemAppearanceAdapter['item']]> = [
  ['song', {id: ids.doxology, song: ids.firstSong, slides: []}],
  ['blank', slidesItem('blank')],
  ['advertisement', slidesItem('ad')],
  ['Bible', bible],
  ['sermon', {id: ids.word, sermon: {title: 'Sermon', passage: bible.bible}}],
  ['liturgy', {id: ids.word, liturgy: {kind: 'prayer', translation: 'new'}}],
  ['media', media],
];

it.each(cases)(
  'passes the same %s item and edit contract to both appearance controls',
  async (_kind, item) => {
    const api = mockLlpApi();
    const editor = new SongEditorStore(api, vi.fn());
    const items = new ServiceItemStore(api, editor, vi.fn());
    const setTheme = vi.fn().mockResolvedValue(true);
    const setBackground = vi.fn().mockResolvedValue(true);
    const adapter: ItemAppearanceAdapter = {
      api,
      items,
      item,
      reason: undefined,
      setTheme,
      setBackground,
    };
    const view = render(<ItemAppearanceRows adapter={adapter} />);
    expect(rows.theme).toHaveBeenLastCalledWith(
      expect.objectContaining({item, items, setTheme}),
    );
    expect(rows.background).toHaveBeenLastCalledWith(
      expect.objectContaining({item, items, setBackground}),
    );
    fireEvent.click(screen.getByRole('button', {name: 'theme'}));
    fireEvent.click(screen.getByRole('button', {name: 'background'}));
    expect(setTheme).toHaveBeenCalledExactlyOnceWith(undefined, null);
    expect(setBackground).toHaveBeenCalledExactlyOnceWith('none');
    view.rerender(
      <ItemAppearanceRows adapter={{...adapter, reason: 'locked'}} />,
    );
    expect(screen.getByRole('button', {name: 'theme'})).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', {name: 'background'})).toHaveProperty(
      'disabled',
      true,
    );
    view.unmount();
    items.dispose();
    await editor.dispose();
  },
);
