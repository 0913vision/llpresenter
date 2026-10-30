import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/platform/live';
import {openItem} from '@renderer/state/show';
import {
  sampleService,
  seedSampleService,
} from '@renderer/show/testing/sampleService';
import type {Notice} from '@renderer/ui/notices';
import {createMemoryColumnWidthStore} from './columnWidthStore';
import {Workspace} from './Workspace';

const problem: Notice = {
  key: 'fixture-background',
  kind: 'warning',
  icon: 'warning',
  title: '배경 변경 실패',
  time: '04:00',
};

vi.mock('@renderer/show/SongBackgroundControl', () => ({
  SongBackgroundControl: ({
    onProblem,
  }: {
    readonly onProblem?: (notice: Notice) => void;
  }) => (
    <button type="button" onClick={() => onProblem?.(problem)}>
      Background fixture
    </button>
  ),
}));
vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

beforeEach(() => {
  seedSampleService();
  useLive.setState({state: null});
});

describe('workspace slide header connection', () => {
  it('keeps item position beside the background control and forwards problems to its host', () => {
    openItem('song-morning');
    const onProblem = vi.fn();
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
        onProblem={onProblem}
      />,
    );
    const panel = within(screen.getByRole('region', {name: '슬라이드'}));
    expect(
      panel.getByText(
        sampleService.rows.find(row => row.id === 'song-morning')?.title ?? '',
      ),
    ).toBeDefined();
    expect(panel.getByText('슬라이드 4개')).toBeDefined();
    fireEvent.click(panel.getByRole('button', {name: 'Background fixture'}));
    expect(onProblem).toHaveBeenCalledWith(problem);
    const base = emptyLiveState();
    act(() =>
      useLive.setState({
        state: {
          ...base,
          layers: {
            ...base.layers,
            slide: {
              itemId: 'song-morning',
              position: 1,
              label: null,
              lines: ['Invented words'],
            },
          },
        },
      }),
    );
    expect(panel.getByText('2 / 4')).toBeDefined();
    expect(
      panel.getByRole('button', {name: 'Background fixture'}),
    ).toBeDefined();
  });

  it('does not mount the show background controller in the prep frame', () => {
    render(
      <Workspace
        id="prep"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    expect(
      screen.queryByRole('button', {name: 'Background fixture'}),
    ).toBeNull();
  });
});
