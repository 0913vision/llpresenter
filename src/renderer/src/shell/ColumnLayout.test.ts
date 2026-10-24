import {describe, expect, it} from 'vitest';
import {ColumnLayout, type DragSession} from './ColumnLayout';
import {centerWidth, type DraggableColumn} from './columns';
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
  layout.refit();
  return {
    layout,
    store,
    shown,
    setWindowWidth: next => {
      width = next;
    },
  };
}

function begin(layout: ColumnLayout, column: DraggableColumn): DragSession {
  const session = layout.beginDrag(column);
  if (!session) throw new Error('The drag did not start');
  return session;
}

function drag(
  layout: ColumnLayout,
  column: DraggableColumn,
  delta: number,
): void {
  const session = begin(layout, column);
  session.move(delta);
  session.end();
}

describe('ColumnLayout', () => {
  it('shows the defaults of the size class when nothing is saved', () => {
    const {shown} = createHarness('normal', 1920);
    expect(shown.at(-1)).toEqual(defaultColumns.normal);
  });

  it('follows the pointer while dragging and saves on release', () => {
    const {layout, shown, store} = createHarness('normal', 1920);
    const session = begin(layout, 'left');
    session.move(40);
    expect(shown.at(-1)).toEqual({left: 320, right: 480});
    expect(store.load('normal')).toBeUndefined();
    session.end();
    expect(store.load('normal')).toEqual({left: 320, right: 480});
  });

  it('measures every move from where the drag started', () => {
    const {layout, shown} = createHarness('normal', 1920);
    const session = begin(layout, 'right');
    session.move(-30);
    session.move(-10);
    expect(shown.at(-1)).toEqual({left: 280, right: 490});
  });

  it('does not start a second drag while one is in progress', () => {
    const {layout} = createHarness('normal', 1920);
    begin(layout, 'left');
    expect(layout.beginDrag('right')).toBeUndefined();
  });

  it('starts a new drag after the previous one ended', () => {
    const {layout} = createHarness('normal', 1920);
    begin(layout, 'left').end();
    expect(layout.beginDrag('right')).toBeDefined();
  });

  it('ignores moves and releases of a drag that has ended', () => {
    const {layout, shown, store} = createHarness('normal', 1920);
    const session = begin(layout, 'left');
    session.move(40);
    session.end();
    const before = shown.length;
    session.move(100);
    session.end();
    expect(shown).toHaveLength(before);
    expect(store.load('normal')).toEqual({left: 320, right: 480});
  });

  it('keeps the widths of each size class apart', () => {
    const {layout, shown} = createHarness('normal', 1920);
    drag(layout, 'left', 40);

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
    drag(layout, 'right', -240);
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
    drag(layout, 'right', -240);

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
    drag(layout, 'right', -240);

    harness.setWindowWidth(1280);
    layout.refit();
    drag(layout, 'left', -40);
    expect(store.load('normal')).toEqual({left: 240, right: 720});
  });

  it('does not overwrite a saved width when a gap is pressed without moving', () => {
    const harness = createHarness('normal', 1920);
    const {layout, shown, store} = harness;
    drag(layout, 'right', -240);
    drag(layout, 'left', 120);

    harness.setWindowWidth(1600);
    layout.refit();
    expect(shown.at(-1)).toEqual({left: 400, right: 624});

    begin(layout, 'right').end();
    expect(store.load('normal')).toEqual({left: 400, right: 720});
  });

  it('does not save a drag that returns to the starting width', () => {
    const {layout, store} = createHarness('normal', 1920);
    const session = begin(layout, 'left');
    session.move(40);
    session.move(0);
    session.end();
    expect(store.load('normal')).toBeUndefined();
  });

  it('leaves the widths alone during a drag when they still fit', () => {
    const harness = createHarness('normal', 1920);
    const {layout, shown} = harness;
    begin(layout, 'left').move(40);
    const before = shown.length;
    layout.refit();
    expect(shown).toHaveLength(before);
  });

  it('fits the widths at once when the window narrows during a drag', () => {
    const harness = createHarness('normal', 1920);
    const {layout, shown} = harness;
    drag(layout, 'right', -240);
    drag(layout, 'left', 120);

    begin(layout, 'right').move(0);
    harness.setWindowWidth(1600);
    layout.refit();
    expect(shown.at(-1)).toEqual({left: 400, right: 624});
    expect(centerWidth(1600, shown.at(-1) ?? {left: 0, right: 0})).toBe(560);
  });

  it('goes on from the fitted widths when the pointer moves again', () => {
    const harness = createHarness('normal', 1920);
    const {layout, shown} = harness;
    drag(layout, 'right', -240);
    drag(layout, 'left', 120);

    const session = begin(layout, 'right');
    session.move(-10);
    harness.setWindowWidth(1600);
    layout.refit();
    expect(shown.at(-1)).toEqual({left: 400, right: 624});
    session.move(-10);
    expect(shown.at(-1)).toEqual({left: 400, right: 624});
    session.move(50);
    expect(shown.at(-1)).toEqual({left: 400, right: 564});
  });

  it('does not save a width that only the window resize shrank', () => {
    const harness = createHarness('normal', 1920);
    const {layout, store} = harness;
    drag(layout, 'right', -240);
    drag(layout, 'left', 120);

    const session = begin(layout, 'right');
    harness.setWindowWidth(1600);
    layout.refit();
    session.end();
    expect(store.load('normal')).toEqual({left: 400, right: 720});
  });

  it('saves the width on screen when the pointer returns to its first place after a resize', () => {
    const harness = createHarness('normal', 1920);
    const {layout, shown, store} = harness;
    drag(layout, 'right', -220);
    drag(layout, 'left', 120);
    expect(store.load('normal')).toEqual({left: 400, right: 700});

    const session = begin(layout, 'right');
    session.move(-10);
    expect(shown.at(-1)).toEqual({left: 400, right: 710});
    harness.setWindowWidth(1600);
    layout.refit();
    expect(shown.at(-1)).toEqual({left: 400, right: 624});
    session.move(0);
    expect(shown.at(-1)).toEqual({left: 400, right: 614});
    session.end();
    expect(store.load('normal')).toEqual({left: 400, right: 614});
    expect(shown.at(-1)).toEqual({left: 400, right: 614});
  });

  it('fits the widths again when the drag ends after the window grew', () => {
    const harness = createHarness('normal', 1600);
    const {layout, shown, store} = harness;
    const session = begin(layout, 'left');
    session.move(60);
    harness.setWindowWidth(1920);
    layout.refit();
    session.end();
    expect(store.load('normal')).toEqual({left: 340, right: 480});
    expect(shown.at(-1)).toEqual({left: 340, right: 480});
  });

  it('drops a drag when the size class changes', () => {
    const {layout, shown, store} = createHarness('normal', 1920);
    const session = begin(layout, 'left');
    layout.setSizeClass('wide');
    session.move(40);
    session.end();
    expect(shown.at(-1)).toEqual(defaultColumns.wide);
    expect(store.load('wide')).toBeUndefined();
  });

  it('lets a stale session end without touching a newer drag', () => {
    const {layout, shown} = createHarness('normal', 1920);
    const stale = begin(layout, 'left');
    layout.setSizeClass('wide');
    layout.setSizeClass('normal');
    const fresh = begin(layout, 'right');
    stale.move(100);
    stale.end();
    fresh.move(-10);
    expect(shown.at(-1)).toEqual({left: 280, right: 490});
  });
});
