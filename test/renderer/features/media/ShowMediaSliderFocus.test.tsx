import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MediaView} from '@renderer/features/media/MediaView';
import {MediaProperties} from '@renderer/features/media/MediaPropertiesPanel';
import {MediaViewProvider} from '@renderer/features/media/MediaViewProvider';
import {handleShowKey} from '@renderer/features/presentation/keyboard/shortcuts';
import * as showState from '@renderer/session/show';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {
  mediaDocument,
  mediaFixture,
  mediaItem,
} from '@fixtures/renderer/features/media/mediaTesting';

afterEach(() => {
  delete window.llp;
});

it.each(['타일 크기', '음량'])(
  'keeps slide keys after pointer use of %s in 진행',
  label => {
    seedSampleService();
    const next = vi
      .spyOn(showState, 'outputNext')
      .mockImplementation(() => undefined);
    const boundary = vi
      .spyOn(showState, 'outputBoundarySlide')
      .mockImplementation(() => undefined);
    const item = mediaItem(1, {kind: 'audio', name: 'Hymn'});
    const fixture = mediaFixture(mediaDocument([item], 5));
    window.llp = fixture.api;
    render(
      <main
        data-workspace-layout="show"
        onKeyDown={event => handleShowKey(event.nativeEvent)}
      >
        <div data-show-slide-grid>
          <div role="listbox" aria-label="슬라이드" tabIndex={0} />
        </div>
        <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
          {label === '타일 크기' ? (
            <MediaView workspace="show" onProblem={vi.fn()} />
          ) : (
            <MediaProperties item={item} disabled={false} workspace="show" />
          )}
        </MediaViewProvider>
      </main>,
    );
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    grid.focus();
    const slider = screen.getByRole('slider', {name: label});
    Object.defineProperty(slider, 'setPointerCapture', {value: vi.fn()});
    fireEvent.pointerDown(slider, {pointerId: 1, button: 0});
    slider.focus();
    fireEvent.pointerUp(slider, {pointerId: 1});
    expect(document.activeElement).toBe(grid);
    fireEvent.keyDown(grid, {key: 'ArrowRight', code: 'ArrowRight'});
    fireEvent.keyDown(grid, {key: 'PageDown', code: 'PageDown'});
    fireEvent.keyDown(grid, {key: 'Home', code: 'Home'});
    fireEvent.keyDown(grid, {key: 'End', code: 'End'});
    expect(next).toHaveBeenCalledTimes(2);
    expect(boundary).toHaveBeenCalledWith('first');
    expect(boundary).toHaveBeenCalledWith('last');
  },
);
