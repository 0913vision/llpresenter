import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PreviewPanel} from '@renderer/ui/previews/PreviewPanel';
import {usePreviewRoom} from '@renderer/ui/previews/usePreviewRoom';
import type {PreviewScreen} from '@renderer/ui/previews/PreviewFrame';
import {PreviewSizingContext} from '@renderer/ui/previews/PreviewSizingContext';
import {clampPreviewRatio} from '@renderer/ui/previews/previewRatio';

vi.mock('@renderer/ui/previews/usePreviewRoom', () => ({usePreviewRoom: vi.fn()}));

const screens: ReadonlyArray<PreviewScreen<string>> = [
  {id: 'audience', name: '청중 화면', shortName: '청중', status: {kind: 'on'}},
  {id: 'stage', name: '무대 화면', shortName: '무대', status: {kind: 'on'}},
  {id: 'broadcast', name: '방송 화면', shortName: '방송', status: {kind: 'on'}},
];

beforeEach(() => {
  vi.mocked(usePreviewRoom).mockReturnValue(true);
});
afterEach(cleanup);

describe('shared preview panel', () => {
  it('shows one picture, chosen in the header', () => {
    const select = vi.fn();
    const change = vi.fn();
    const {container} = render(
      <PreviewPanel
        screens={screens}
        big="audience"
        visible={false}
        onVisibleChange={change}
        onBigChange={select}
        renderScreen={entry => <span>{entry.id}</span>}
      />,
    );
    expect(
      container.querySelector('[data-role="large"]')?.textContent,
    ).toContain('audience');
    expect(container.querySelectorAll('[data-preview-slot]')).toHaveLength(0);
    expect(
      screen.getAllByRole('radio').map(radio => radio.textContent),
    ).toEqual(['청중', '무대', '방송', '전체']);
    expect(
      screen.getByRole('radio', {name: '청중'}).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('radio', {name: '무대'}));
    expect(select).toHaveBeenCalledWith('stage');
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', {name: '전체'}));
    expect(change).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('goes from the three screens to the one that is chosen', () => {
    const change = vi.fn();
    const select = vi.fn();
    render(
      <PreviewPanel
        screens={screens}
        big="audience"
        visible
        onVisibleChange={change}
        onBigChange={select}
        renderScreen={() => null}
      />,
    );
    expect(
      screen.getByRole('radio', {name: '전체'}).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('radio', {name: '무대'}));
    expect(select).toHaveBeenCalledWith('stage');
    expect(change).toHaveBeenCalledWith(false);
  });
  it('keeps adjustable show tiles and resets the saved split on double click', () => {
    vi.mocked(usePreviewRoom).mockReturnValue(false);
    const save = vi.fn();
    const {container} = render(
      <PreviewSizingContext.Provider value={{ratio: 0.5, save}}>
        <PreviewPanel
          screens={screens}
          big="audience"
          onBigChange={vi.fn()}
          renderScreen={() => null}
        />
      </PreviewSizingContext.Provider>,
    );
    expect(
      screen.getByRole('button', {name: '무대 화면 크게 보기'}),
    ).toBeDefined();
    const divider = container.querySelector('[data-row-gap="preview.split"]');
    if (!divider) throw Error('Missing preview divider');
    fireEvent.doubleClick(divider);
    expect(save).toHaveBeenCalledWith(0.667);
  });
  it('clamps a stored bad split and restores the starting split after dragging back', () => {
    const save = vi.fn();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    const {container} = render(
      <PreviewSizingContext.Provider value={{ratio: 8, save}}>
        <PreviewPanel
          screens={screens}
          big="audience"
          onBigChange={vi.fn()}
          renderScreen={() => null}
        />
      </PreviewSizingContext.Provider>,
    );
    const divider = container.querySelector<HTMLElement>(
      '[data-row-gap="preview.split"]',
    );
    const monitor = container.querySelector<HTMLElement>(
      '[style*="--preview-ratio"]',
    );
    if (divider === null || monitor?.parentElement == null) {
      throw new Error('Missing split');
    }
    Object.defineProperty(monitor.parentElement, 'clientHeight', {
      configurable: true,
      value: 400,
    });
    expect(monitor.style.getPropertyValue('--preview-ratio')).toBe('0.85');
    fireEvent.pointerDown(divider, {pointerId: 1, button: 0, clientY: 100});
    fireEvent.pointerMove(divider, {pointerId: 1, clientY: -100});
    expect(
      Number(monitor.style.getPropertyValue('--preview-ratio')),
    ).toBeCloseTo(0.35);
    fireEvent.pointerMove(divider, {pointerId: 1, clientY: 100});
    fireEvent.pointerUp(divider, {pointerId: 1, clientY: 100});
    expect(save).toHaveBeenLastCalledWith(0.85);
    fireEvent.doubleClick(divider);
    expect(save).toHaveBeenLastCalledWith(0.667);
  });
  it('moves the divider only inside what the rows can show, so dragging back follows the pointer', () => {
    const save = vi.fn();
    HTMLElement.prototype.setPointerCapture = vi.fn();
    const {container} = render(
      <PreviewSizingContext.Provider value={{ratio: 0.85, save}}>
        <PreviewPanel
          screens={screens}
          big="audience"
          onBigChange={vi.fn()}
          renderScreen={() => null}
        />
      </PreviewSizingContext.Provider>,
    );
    const divider = container.querySelector<HTMLElement>(
      '[data-row-gap="preview.split"]',
    );
    const monitor = container.querySelector<HTMLElement>(
      '[style*="--preview-ratio"]',
    );
    if (divider === null || monitor?.parentElement == null) {
      throw new Error('Missing split');
    }
    for (const [name, value] of [
      ['--size-control-md', '30px'],
      ['--size-control-sm', '26px'],
      ['--space-12', '12px'],
      ['--preview-tile-min', '120px'],
    ] as const) {
      monitor.style.setProperty(name, value);
    }
    Object.defineProperty(monitor.parentElement, 'clientHeight', {
      configurable: true,
      value: 300,
    });
    const shown = () =>
      Number(monitor.style.getPropertyValue('--preview-ratio'));
    const most = 1 - 67.5 / 232;
    fireEvent.pointerDown(divider, {pointerId: 1, button: 0, clientY: 100});
    fireEvent.pointerMove(divider, {pointerId: 1, clientY: 150});
    expect(shown()).toBeCloseTo(most);
    fireEvent.pointerMove(divider, {pointerId: 1, clientY: 50});
    expect(shown()).toBeCloseTo(most - 50 / 232);
    fireEvent.pointerMove(divider, {pointerId: 1, clientY: 100});
    fireEvent.pointerUp(divider, {pointerId: 1, clientY: 100});
    expect(save).toHaveBeenLastCalledWith(most);
  });
  it('clamps invalid and out-of-range saved ratios', () => {
    expect(clampPreviewRatio(9)).toBe(0.85);
    expect(clampPreviewRatio(-1)).toBe(0.15);
    expect(clampPreviewRatio(Number.NaN)).toBe(0.667);
  });
  it('resets the saved split when either preview layout is selected', () => {
    const save = vi.fn();
    const change = vi.fn();
    const panel = (visible: boolean) => (
      <PreviewSizingContext.Provider value={{ratio: 0.85, save}}>
        <PreviewPanel
          screens={screens}
          big="audience"
          visible={visible}
          onVisibleChange={change}
          onBigChange={vi.fn()}
          renderScreen={() => null}
        />
      </PreviewSizingContext.Provider>
    );
    const view = render(panel(true));
    fireEvent.click(screen.getByRole('radio', {name: '청중'}));
    expect(save).toHaveBeenLastCalledWith(0.667);
    expect(change).toHaveBeenLastCalledWith(false);
    view.rerender(panel(false));
    fireEvent.click(screen.getByRole('radio', {name: '전체'}));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(0.667);
    expect(change).toHaveBeenLastCalledWith(true);
  });
  it('replaces tiles with the ordered header picker when space runs out', () => {
    const select = vi.fn();
    const panel = () => (
      <PreviewPanel
        screens={screens}
        big="audience"
        onBigChange={select}
        renderScreen={entry => <span>{entry.id}</span>}
      />
    );
    const view = render(panel());
    expect(screen.getByRole('region', {name: '미리보기'})).toBeDefined();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(
      screen.getByRole('button', {name: '무대 화면 크게 보기'}),
    ).toBeDefined();

    vi.mocked(usePreviewRoom).mockReturnValue(false);
    view.rerender(panel());
    expect(
      screen.queryByRole('button', {name: '무대 화면 크게 보기'}),
    ).toBeNull();
    expect(
      screen.getAllByRole('radio').map(radio => radio.textContent),
    ).toEqual(['청중 화면', '무대 화면', '방송 화면']);
    fireEvent.click(screen.getByRole('radio', {name: '무대 화면'}));
    expect(select).toHaveBeenCalledWith('stage');
  });

  it('keeps one blank picture and caption without screen controls for an empty item', () => {
    vi.mocked(usePreviewRoom).mockReturnValue(false);
    const view = render(
      <PreviewPanel
        screens={screens}
        big="audience"
        blank
        onBigChange={vi.fn()}
        renderScreen={() => null}
        caption={() => <span>선택한 슬라이드</span>}
      />,
    );
    expect(
      view.container.querySelectorAll(
        '[data-screen]:not([aria-hidden="true"])',
      ),
    ).toHaveLength(1);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText('선택한 슬라이드')).toBeNull();
  });
});
