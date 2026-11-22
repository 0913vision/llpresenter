import {describe, expect, it} from 'vitest';
import {
  DEFAULT_OVERLAY_TEXT_STYLE,
  OverlayTextView,
} from '@renderer/rendering/overlayText';

function setUp() {
  const parent = document.createElement('div');
  const view = new OverlayTextView(parent);
  const shown = () => {
    const canvas = parent.firstElementChild;
    return canvas instanceof HTMLElement && !canvas.hidden ? canvas : null;
  };
  const block = () => shown()?.querySelector<HTMLElement>('div');
  return {parent, view, shown, block};
}

describe('OverlayTextView', () => {
  it('draws in the same elements through many changes and clears', () => {
    const {parent, view, shown} = setUp();
    view.show('First');
    const canvas = shown();
    for (let change = 0; change < 20; change += 1) {
      view.show(`Message ${change}\n${'Line\n'.repeat(10)}`);
      if (change % 3 === 0) view.show(null);
    }
    view.show('Last');
    expect(shown()).toBe(canvas);
    expect(parent.children).toHaveLength(1);
    view.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('shows nothing once it is cleared', () => {
    const {view, shown} = setUp();
    view.show('설교 시간 30분 남음');
    view.show(null);
    expect(shown()).toBeNull();
    view.show('Again');
    expect(shown()?.textContent).toBe('Again');
  });

  it('draws a text as it is, in one row for each of its rows', () => {
    const {view, block} = setUp();
    view.show('<script>not markup</script>\nSecond line');
    expect(
      [...(block()?.children ?? [])].map(({textContent}) => textContent),
    ).toEqual(['<script>not markup</script>', 'Second line']);
    expect(block()?.querySelector('script')).toBeNull();
  });

  it('takes a new style in place', () => {
    const {view, block} = setUp();
    view.show('Same text');
    const before = block();
    view.show('Same text', {
      ...DEFAULT_OVERLAY_TEXT_STYLE,
      color: '#00FF00',
      align: 'left',
      margin: 10,
    });
    expect(block()).toBe(before);
    expect(before?.style).toMatchObject({
      color: 'rgb(0, 255, 0)',
      textAlign: 'left',
      left: '192px',
      width: '1536px',
    });
  });

  it('scales with the screen', () => {
    const {view, shown} = setUp();
    view.show('Text');
    view.rescale(0.5);
    expect(shown()?.style.transform).toBe('scale(0.5)');
  });

  it('replaces a shown text in place, and shows none that replaced nothing', () => {
    const {view, shown} = setUp();
    view.replace('Before anything');
    expect(shown()).toBeNull();
    view.show('Before anything');
    view.replace('Changed in place');
    expect(shown()?.textContent).toBe('Changed in place');
  });
});
