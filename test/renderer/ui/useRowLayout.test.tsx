import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useRowLayout} from '@renderer/ui/useRowLayout';
import type {PanelRows} from '@core/schema/panelRows';

afterEach(() => {
  document.body.replaceChildren();
});

function setup(fixed = false, minimum = false) {
  const parent = document.createElement('div');
  parent.style.setProperty('--panel-gap', '4px');
  parent.style.display = 'flex';
  let height = fixed ? 616 : minimum ? 304 : 604;
  Object.defineProperty(parent, 'clientHeight', {get: () => height});
  const ids = fixed
    ? ['show.preview', '', 'show.tools']
    : ['show.order', 'show.quick'];
  const initial = fixed ? [250, 58, 300] : [300, 300];
  const minimums = fixed ? [140, 58, 240] : [100, 200];
  const elements = ids.map((id, index) => {
    const element = document.createElement('div');
    element.dataset['resizePanel'] = id;
    if (!id) element.dataset['resizeFixed'] = '';
    element.style.minHeight = `${minimums[index] ?? 0}px`;
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(
      () =>
        new DOMRect(
          0,
          0,
          300,
          element.style.height
            ? parseFloat(element.style.height)
            : ((minimum ? minimums[index] : initial[index]) ?? 0),
        ),
    );
    parent.append(element);
    return element;
  });
  document.body.append(parent);
  let saved: PanelRows | undefined;
  const saveRows = vi.fn((_sizeClass: string, rows: PanelRows) => {
    saved = {...saved, ...rows};
  });
  const store = {loadRows: () => saved, saveRows};
  const container = {current: parent};
  const hook = renderHook(() =>
    useRowLayout({
      container,
      store,
      sizeClass: 'normal',
      layoutKey: 'test',
      fill: 'first',
    }),
  );
  const heights = () =>
    elements.map(element => parseFloat(element.style.height));
  return {
    ...hook,
    parent,
    elements,
    heights,
    store,
    resize: (next: number) => {
      height = next;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
    },
  };
}

describe('useRowLayout', () => {
  it('drags a row border, clamps both minimums, and saves only on release', () => {
    const h = setup();
    expect(h.result.current.canResize(0)).toBe(true);
    const drag = h.result.current.begin(0);
    if (!drag) throw new Error('Missing drag');
    act(() => drag.move(1000));
    expect(h.heights()).toEqual([400, 200]);
    expect(h.store.saveRows).not.toHaveBeenCalled();
    act(() => drag.move(-1000));
    expect(h.heights()).toEqual([100, 500]);
    act(() => drag.end());
    expect(h.store.saveRows).toHaveBeenCalledExactlyOnceWith('normal', {
      'show.order': 100,
      'show.quick': 500,
    });
    h.resize(304);
    expect(h.heights()).toEqual([100, 200]);
    expect(h.result.current.canResize(0)).toBe(false);
    expect(h.store.saveRows).toHaveBeenCalledOnce();
    h.resize(604);
    expect(h.heights()).toEqual([100, 500]);
    h.unmount();
  });

  it.each([0, 1])(
    'keeps a fixed control intact when dragging adjacent border %s',
    index => {
      const h = setup(true);
      const drag = h.result.current.begin(index);
      if (!drag) throw new Error('Missing drag');
      act(() => drag.move(100));
      expect(h.heights()).toEqual([310, 58, 240]);
      act(() => drag.end());
      expect(h.store.saveRows).toHaveBeenCalledWith('normal', {
        'show.preview': 310,
        'show.tools': 240,
      });
      h.unmount();
    },
  );

  it('refuses a border with no room beyond its panel minimums', () => {
    const h = setup(false, true);
    expect(h.result.current.canResize(0)).toBe(false);
    expect(h.result.current.begin(0)).toBeUndefined();
    expect(h.store.saveRows).not.toHaveBeenCalled();
    h.unmount();
  });

  it('releases observers, inline sizes, and the active session on unmount', () => {
    const h = setup();
    const drag = h.result.current.begin(0);
    if (!drag) throw new Error('Missing drag');
    act(() => drag.move(20));
    h.unmount();
    drag.move(50);
    drag.end();
    expect(h.elements.every(element => element.style.height === '')).toBe(true);
    expect(h.store.saveRows).not.toHaveBeenCalled();
  });
});
