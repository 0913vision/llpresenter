import {describe, expect, it} from 'vitest';
import {ColumnLayout} from './ColumnLayout';
import {
  createMemoryColumnWidthStore,
  type ColumnWidthStore,
} from './columnWidthStore';
import {defaultColumns, type ColumnWidths, type SizeClass} from './sizeClass';

interface Harness {
  readonly layout: ColumnLayout;
  readonly store: ColumnWidthStore;
  readonly shown: ColumnWidths[];
  setWindowWidth(width: number): void;
}

function createHarness(
  sizeClass: SizeClass,
  windowWidth: number,
  store = createMemoryColumnWidthStore(),
): Harness {
  let width = windowWidth;
  const shown: ColumnWidths[] = [];
  const layout = new ColumnLayout({
    store,
    sizeClass,
    windowWidth: () => width,
    show: widths => shown.push(widths),
  });
  return {
    layout,
    store,
    shown,
    setWindowWidth: next => {
      width = next;
    },
  };
}

describe('ColumnLayout', () => {
  it('shows the defaults of the size class when nothing is saved', () => {
    const {shown} = createHarness('normal', 1920);
    expect(shown.at(-1)).toEqual(defaultColumns.normal);
  });

  it('follows the pointer while dragging and saves on release', () => {
    const {layout, shown, store} = createHarness('normal', 1920);
    layout.beginDrag('left');
    layout.dragBy(40);
    expect(shown.at(-1)).toEqual({left: 320, right: 480});
    expect(store.load('normal')).toBeUndefined();
    layout.endDrag();
    expect(store.load('normal')).toEqual({left: 320, right: 480});
  });

  it('measures every move from where the drag started', () => {
    const {layout, shown} = createHarness('normal', 1920);
    layout.beginDrag('right');
    layout.dragBy(-30);
    layout.dragBy(-10);
    expect(shown.at(-1)).toEqual({left: 280, right: 490});
  });

  it('ignores moves and releases without a drag', () => {
    const {layout, shown, store} = createHarness('normal', 1920);
    const before = shown.length;
    layout.dragBy(100);
    layout.endDrag();
    expect(shown).toHaveLength(before);
    expect(store.load('normal')).toBeUndefined();
  });

  it('keeps the widths of each size class apart', () => {
    const {layout, shown} = createHarness('normal', 1920);
    layout.beginDrag('left');
    layout.dragBy(40);
    layout.endDrag();

    layout.setSizeClass('wide');
    expect(shown.at(-1)).toEqual(defaultColumns.wide);
    layout.setSizeClass('normal');
    expect(shown.at(-1)).toEqual({left: 320, right: 480});
  });

  it('does nothing when the size class stays the same', () => {
    const {layout, shown} = createHarness('normal', 1920);
    const before = shown.length;
    layout.setSizeClass('normal');
    expect(shown).toHaveLength(before);
  });

  it('shrinks on screen when the window narrows and restores when it grows', () => {
    const harness = createHarness('normal', 1920);
    const {layout, shown} = harness;
    layout.beginDrag('right');
    layout.dragBy(-240);
    layout.endDrag();
    expect(shown.at(-1)).toEqual({left: 280, right: 720});

    harness.setWindowWidth(1500);
    layout.refit();
    expect(shown.at(-1)).toEqual({left: 280, right: 644});

    harness.setWindowWidth(1920);
    layout.refit();
    expect(shown.at(-1)).toEqual({left: 280, right: 720});
  });

  it('keeps the saved widths while the screen shows shrunk ones', () => {
    const harness = createHarness('normal', 1920);
    const {layout, shown, store} = harness;
    layout.beginDrag('right');
    layout.dragBy(-240);
    layout.endDrag();

    harness.setWindowWidth(1280);
    layout.refit();
    expect(shown.at(-1)).toEqual({left: 280, right: 424});
    expect(store.load('normal')).toEqual({left: 280, right: 720});

    harness.setWindowWidth(1920);
    layout.refit();
    expect(shown.at(-1)).toEqual({left: 280, right: 720});
  });

  it('saves only the dragged column when the other one is shrunk', () => {
    const harness = createHarness('normal', 1920);
    const {layout, store} = harness;
    layout.beginDrag('right');
    layout.dragBy(-240);
    layout.endDrag();

    harness.setWindowWidth(1280);
    layout.refit();
    layout.beginDrag('left');
    layout.dragBy(-40);
    layout.endDrag();
    expect(store.load('normal')).toEqual({left: 240, right: 720});
  });

  it('does not refit in the middle of a drag', () => {
    const harness = createHarness('normal', 1920);
    const {layout, shown} = harness;
    layout.beginDrag('left');
    layout.dragBy(40);
    const before = shown.length;
    layout.refit();
    expect(shown).toHaveLength(before);
  });

  it('drops a drag when the size class changes', () => {
    const {layout, shown, store} = createHarness('normal', 1920);
    layout.beginDrag('left');
    layout.setSizeClass('wide');
    layout.dragBy(40);
    layout.endDrag();
    expect(shown.at(-1)).toEqual(defaultColumns.wide);
    expect(store.load('wide')).toBeUndefined();
  });
});
