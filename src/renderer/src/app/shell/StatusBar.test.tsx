import {cleanup, render, screen} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {OutputStatuses} from '@core/schema/outputStatus';
import {StatusBar} from './StatusBar';

const fixture = vi.hoisted((): {statuses: OutputStatuses} => ({statuses: {}}));
vi.mock('@renderer/screens/useOutputStatuses', () => ({
  useOutputStatuses: () => fixture.statuses,
}));
vi.mock('../../platform/ScreenSummaries', () => ({
  useScreenSummaries: () => [
    {id: 'stage', statusLabel: '\uBB34\uB300 \uD654\uBA74'},
    {id: 'stream', statusLabel: '\uBC29\uC1A1 \uC790\uB9C9'},
  ],
}));
afterEach(() => {
  cleanup();
  fixture.statuses = {};
});

describe('StatusBar', () => {
  it('keeps a fixed empty status region in normal operation', () => {
    fixture.statuses = {
      stage: {
        placement: 'fullscreen',
        renderer: 'running',
        fps: 60,
        fpsLow: false,
      },
    };
    const {container} = render(<StatusBar />);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(container.querySelectorAll('svg, [aria-hidden]')).toHaveLength(0);
    expect(
      readFileSync('src/renderer/src/app/shell/StatusBar.module.css', 'utf8'),
    ).toMatch(/height:\s*var\(--size-statusbar\)/);
  });
  it('shows current output problems and clears them on recovery', () => {
    fixture.statuses = {
      stage: {
        placement: 'monitorMissing',
        renderer: 'running',
        fps: 60,
        fpsLow: false,
      },
      stream: {placement: 'window', renderer: 'running', fps: 41, fpsLow: true},
    };
    const view = render(<StatusBar />);
    expect(screen.getByRole('status').textContent).toContain(
      '\uBB34\uB300 \uD654\uBA74 \uCC3D\uC73C\uB85C \uD45C\uC2DC \uC911',
    );
    expect(screen.getByRole('status').textContent).toContain(
      '\uD504\uB808\uC784 \uC18D\uB3C4\uAC00 \uB0AE\uC544\uC9C0\uB294 \uC911: \uBC29\uC1A1 \uC790\uB9C9 (41fps)',
    );
    fixture.statuses = {};
    view.rerender(<StatusBar />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('shows standby while the recovery decision is pending', () => {
    const view = render(<StatusBar standby />);
    expect(screen.getByRole('status').textContent).toBe('\uB300\uAE30');
    view.rerender(<StatusBar standby={false} />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('shows saving and failure messages while those states last', () => {
    const view = render(<StatusBar saveState="saving" />);
    expect(screen.getByRole('status').textContent).toBe(
      '\uC800\uC7A5\uC744 \uC2DC\uB3C4\uD558\uB294 \uC911...',
    );
    view.rerender(<StatusBar saveState="failed" />);
    expect(screen.getByRole('status').textContent).toBe(
      '\uC800\uC7A5\uD558\uC9C0 \uBABB\uD568',
    );
    view.rerender(<StatusBar />);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('keeps every long message in the scrollable direction', () => {
    fixture.statuses = {
      stage: {
        placement: 'monitorMissing',
        renderer: 'limited',
        fps: 41,
        fpsLow: true,
      },
      stream: {
        placement: 'monitorMissing',
        renderer: 'limited',
        fps: 40,
        fpsLow: true,
      },
    };
    render(<StatusBar standby saveState="failed" />);
    expect(screen.getByRole('status').querySelectorAll('span')).toHaveLength(8);
    const css = readFileSync(
      'src/renderer/src/app/shell/StatusBar.module.css',
      'utf8',
    );
    expect(css).not.toMatch(/justify-content:\s*flex-end/);
    expect(css).toMatch(
      /\.bar > span:first-child\s*\{\s*margin-inline-start:\s*auto/,
    );
    expect(css).toMatch(
      /\.bar > span\s*\{\s*flex:\s*none;\s*white-space:\s*nowrap/,
    );
    expect(css).toMatch(/overflow-x:\s*auto/);
    expect(css).toMatch(/\.bar::-webkit-scrollbar\s*\{\s*height:\s*6px/);
    const tokens = readFileSync('src/renderer/src/styles/tokens.css', 'utf8');
    expect(tokens).toMatch(/--size-statusbar:\s*28px/);
    expect(tokens).toMatch(/--type-caption:\s*400 14px\/20px/);
  });

  it('uses the readable text token on the app background', () => {
    const css = readFileSync(
      'src/renderer/src/app/shell/StatusBar.module.css',
      'utf8',
    );
    const tokens = readFileSync('src/renderer/src/styles/tokens.css', 'utf8');
    expect(css).toMatch(/color:\s*var\(--text-3\)/);
    const luminance = (name: string): number => {
      const hex = new RegExp(`--${name}: #([0-9a-f]{6})`).exec(tokens)?.[1];
      if (!hex) throw new Error('Missing token');
      const rgb = [0, 2, 4]
        .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return (
        0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0)
      );
    };
    expect(
      (luminance('text-3') + 0.05) / (luminance('bg-app') + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
