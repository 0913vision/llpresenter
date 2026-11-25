import {act, cleanup, render, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {ServiceItem} from '@core/schema/services/service';
import {usePaletteInsert} from '@renderer/features/service/items/usePaletteInsert';
import {useShow} from '@renderer/session/show/showStore';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {useThemes} from '@renderer/platform/documents/themes';
import {themes, themeScreens} from '@fixtures/core/themeOutput';

const order = vi.hoisted(() => ({
  insertNewItem:
    vi.fn<(item: ServiceItem, before: unknown, options: unknown) => void>(),
  rowAfterSelected: vi.fn(() => null),
}));
vi.mock('@renderer/session/service/insertIntoOrder', () => order);
vi.mock('@renderer/features/service/items/BibleQuickAdd', () => ({
  BibleQuickAdd: () => <div>성경 구절 추가</div>,
}));
vi.mock('@renderer/features/service/items/SermonQuickAdd', () => ({
  SermonQuickAdd: () => <div>설교 추가</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  seedSampleService();
  useThemes.setState({themes: themes(), screens: themeScreens});
});
afterEach(cleanup);

function setup() {
  const report = vi.fn();
  return {report, hook: renderHook(() => usePaletteInsert(report))};
}

function inserted(): ServiceItem | undefined {
  return order.insertNewItem.mock.lastCall?.[0];
}

it('puts an element after the selected row, or before the row it was dropped on', () => {
  const {hook} = setup();
  act(() => hook.result.current.insert('blank'));
  expect(order.rowAfterSelected).toHaveBeenCalled();
  expect(inserted()?.kind).toBe('blank');
  expect(order.insertNewItem.mock.lastCall?.[1]).toBeNull();

  act(() =>
    hook.result.current.insert('header', {
      before: '00000000-0000-4000-8000-000000000201',
      edit: true,
    }),
  );
  expect(inserted()?.kind).toBe('header');
  expect(order.insertNewItem.mock.lastCall?.[1]).toBe(
    '00000000-0000-4000-8000-000000000201',
  );
  expect(order.insertNewItem.mock.lastCall?.[2]).toMatchObject({edit: true});
});

it('asks for a passage before a 성경 구절 or a 설교 goes in', () => {
  const {hook} = setup();
  act(() => hook.result.current.insert('bible'));
  expect(order.insertNewItem).not.toHaveBeenCalled();
  const bible = render(<>{hook.result.current.dialog}</>);
  expect(bible.getByText('성경 구절 추가')).toBeDefined();
  bible.unmount();

  act(() => hook.result.current.insert('sermon'));
  const sermon = render(<>{hook.result.current.dialog}</>);
  expect(sermon.getByText('설교 추가')).toBeDefined();
});

it('puts nothing in a 예배 that is read only, or when none is open', () => {
  const {hook} = setup();
  act(() => useShow.setState({readOnly: true}));
  hook.rerender();
  expect(hook.result.current.disabled).toBe(true);
  act(() => hook.result.current.insert('blank'));
  act(() => useShow.setState({readOnly: false, serviceId: null}));
  hook.rerender();
  act(() => hook.result.current.insert('blank'));
  expect(order.insertNewItem).not.toHaveBeenCalled();
});
