import {useContext} from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {PanelColumn} from '@renderer/app/shell/workspace/PanelColumn';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columns/columnWidthStore';
import {PreviewSizingContext} from '@renderer/ui/previews/PreviewSizingContext';

const layout = vi.hoisted(() => ({reset: vi.fn()}));
vi.mock('@renderer/ui/lists/useRowLayout', () => ({
  useRowLayout: () => ({
    begin: vi.fn(),
    canResize: () => true,
    reset: layout.reset,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Ratio() {
  const sizing = useContext(PreviewSizingContext);
  return <span data-testid="ratio">{sizing?.ratio}</span>;
}

it('clamps a stored preview ratio on load and resets it with the outer divider', () => {
  const store = createMemoryColumnWidthStore();
  store.saveRows?.('normal', {'show.previewRatio': 32000});
  const {container} = render(
    <PanelColumn
      workspace="show"
      titles={['미리보기', '진행 도구']}
      partsOf={() => ({embedded: <Ratio />})}
      store={store}
      sizeClass="normal"
      draft={false}
      warningHeight={0}
    />,
  );
  expect(screen.getAllByTestId('ratio')[0]?.textContent).toBe('0.85');
  const divider = container.querySelector('[data-row-gap="show.미리보기"]');
  if (divider === null) throw new Error('Missing preview divider');
  fireEvent.doubleClick(divider);
  expect(layout.reset).toHaveBeenCalledOnce();
  expect(screen.getAllByTestId('ratio')[0]?.textContent).toBe('0.667');
  expect(store.loadRows?.('normal')?.['show.previewRatio']).toBe(667);
});
