import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {UiState} from '@core/schema/uiState';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {
  SlideSurfaceView,
  seedSlideSurfaceView,
} from '@renderer/features/songs/editor/SlideSurfaceView';

afterEach(() => {
  resetTooltips();
  seedSlideSurfaceView({});
});
describe('slide surface preferences', () => {
  it('shows icon buttons with accessible names and starts in list view', () => {
    seedSlideSurfaceView({});
    render(<SlideSurfaceView />);
    const list = screen.getByRole('button', {name: '\uBAA9\uB85D'});
    const grid = screen.getByRole('button', {name: '\uACA9\uC790'});
    expect(list.textContent).toBe('');
    expect(grid.textContent).toBe('');
    expect(list.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(grid.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(grid.getAttribute('aria-pressed')).toBe('false');
    expect(list.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(grid);
    expect(grid.getAttribute('aria-pressed')).toBe('true');
    expect(list.getAttribute('aria-pressed')).toBe('false');
  });

  it.each(['\uBAA9\uB85D', '\uACA9\uC790'])(
    'shows the %s icon tooltip',
    async label => {
      render(<SlideSurfaceView />);
      const tooltip = await hoverForTooltip(
        screen.getByRole('button', {name: label}),
      );
      expect(tooltip?.textContent).toBe(label);
    },
  );

  it('restores each window preference and saves a choice to ui state', () => {
    const setLayout = vi.fn();
    const api = mockLlpApi({ui: {setLayout}});
    const saved: UiState = {
      layout: {
        normal: {
          editorSlideView: 'grid',
          editorSlideScalePercent: 150,
          songEditorSlideView: 'list',
          songEditorSlideScalePercent: 80,
        },
      },
    };
    seedSlideSurfaceView(saved);
    render(<SlideSurfaceView ui={api.ui} />);
    expect(
      screen
        .getByRole('button', {name: '\uACA9\uC790'})
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', {name: '\uBAA9\uB85D'}));
    expect(setLayout).toHaveBeenCalledWith({
      sizeClass: 'normal',
      editorSlideView: 'list',
    });
    act(() => seedSlideSurfaceView(saved, 'song'));
    fireEvent.click(screen.getByRole('button', {name: '\uACA9\uC790'}));
    expect(setLayout).toHaveBeenLastCalledWith({
      sizeClass: 'normal',
      songEditorSlideView: 'grid',
    });
    expect(
      screen.getByRole('spinbutton', {
        name: '\uC2AC\uB77C\uC774\uB4DC \uD06C\uAE30 \uBC31\uBD84\uC728',
      }),
    ).toHaveProperty('value', '80%');
  });
});
