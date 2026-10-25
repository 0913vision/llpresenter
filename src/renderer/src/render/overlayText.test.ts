import {describe, expect, it} from 'vitest';
import {classes} from './classes';
import {DEFAULT_MESSAGE_STYLE, OverlayTextView} from './overlayText';

function setUp() {
  const parent = document.createElement('div');
  const view = new OverlayTextView(parent);
  const front = () =>
    parent.querySelector<HTMLElement>(`.${classes.page}.${classes.shown}`);
  return {parent, view, front};
}

describe('OverlayTextView', () => {
  it('reuses its pages and keeps a bounded row count across long multiline changes and clears', () => {
    const {parent, view} = setUp();
    const pages = [...parent.querySelectorAll(`.${classes.page}`)];
    for (let change = 0; change < 100; change += 1) {
      view.show(`Message ${change}\n${'Line\n'.repeat(200)}`);
      if (change % 3 === 0) view.show(null);
    }
    expect([...parent.querySelectorAll(`.${classes.page}`)]).toEqual(pages);
    expect(parent.querySelectorAll(`.${classes.block} > div`)).toHaveLength(2);
    view.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('renders text literally and preserves newlines in one row', () => {
    const {view, front} = setUp();
    const text = '<script>not markup</script>\nSecond line';
    view.show(text);
    expect(front()?.textContent).toBe(text);
    expect(front()?.querySelector('script')).toBeNull();
  });

  it('keeps unchanged text on the same page and updates a stored prop style in place', () => {
    const {view, front} = setUp();
    view.show('Same text');
    const page = front();
    view.show('Same text', {...DEFAULT_MESSAGE_STYLE});
    expect(front()).toBe(page);
    view.show('Same text', {
      ...DEFAULT_MESSAGE_STYLE,
      color: '#00FF00',
      align: 'left',
      margin: 10,
    });
    expect(front()).toBe(page);
    expect(front()?.style.inset).toBe('10%');
    expect(front()?.style.textAlign).toBe('left');
    expect(
      front()?.querySelector<HTMLElement>(`.${classes.block}`)?.style.color,
    ).toBe('rgb(0, 255, 0)');
    view.rescale(0.5);
    expect(
      front()?.querySelector<HTMLElement>(`.${classes.block}`)?.style.fontSize,
    ).toBe('42px');
  });

  it('clears immediately and can show text again without recreating pages', () => {
    const {parent, view, front} = setUp();
    view.show('First');
    const pages = [...parent.querySelectorAll(`.${classes.page}`)];
    view.show(null);
    expect(front()).toBeNull();
    view.show('Again');
    expect(front()?.textContent).toBe('Again');
    expect([...parent.querySelectorAll(`.${classes.page}`)]).toEqual(pages);
  });
});
