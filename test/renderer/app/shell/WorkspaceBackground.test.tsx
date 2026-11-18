import {act, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {openItem} from '@renderer/session/show';
import {
  sampleService,
  seedSampleService,
} from '@fixtures/renderer/session/sampleService';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {Workspace} from '@renderer/app/shell/Workspace';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    ready = () => true;
    revealIncomplete = () => undefined;
    render = vi.fn();
    dispose = vi.fn();
  },
}));

beforeEach(() => {
  seedSampleService();
  useLive.setState({state: null});
});

describe('workspace slide header connection', () => {
  it('keeps the item title and position in the slide header, without a background control', () => {
    openItem('song-morning');
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const panel = within(screen.getByRole('region', {name: '슬라이드'}));
    expect(
      panel.getAllByText(
        sampleService.rows.find(row => row.id === 'song-morning')?.title ?? '',
      ).length,
    ).toBeGreaterThan(0);
    expect(panel.getByText('4개')).toBeDefined();
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
    expect(panel.queryByRole('button', {name: /배경/})).toBeNull();
  });
});
