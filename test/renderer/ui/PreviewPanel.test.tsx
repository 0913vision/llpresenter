import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PreviewPanel} from '@renderer/ui/PreviewPanel';
import {usePreviewRoom} from '@renderer/ui/usePreviewRoom';
import type {PreviewScreen} from '@renderer/ui/PreviewFrame';
import {PreviewSizingContext} from '@renderer/ui/PreviewSizingContext';

vi.mock('@renderer/ui/usePreviewRoom', () => ({usePreviewRoom: vi.fn()}));

const screens: ReadonlyArray<PreviewScreen<string>> = [
  {id: 'audience', name: '청중 화면', status: {kind: 'on'}},
  {id: 'stage', name: '무대 화면', status: {kind: 'on'}},
  {id: 'broadcast', name: '방송 화면', status: {kind: 'on'}},
];

beforeEach(() => {
  vi.mocked(usePreviewRoom).mockReturnValue(true);
});
afterEach(cleanup);

describe('shared preview panel', () => {
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
