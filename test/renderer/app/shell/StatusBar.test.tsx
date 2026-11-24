import {cleanup, render, screen} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {OutputStatuses} from '@core/schema/live/outputStatus';
import {StatusBar} from '@renderer/app/shell/StatusBar';

const fixture = vi.hoisted((): {statuses: OutputStatuses} => ({statuses: {}}));
const identity = vi.hoisted(() => ({unavailable: false}));
vi.mock('@renderer/features/screens/useMonitors', () => ({
  useMonitors: () => [{identityUnavailable: identity.unavailable}],
}));
vi.mock('@renderer/features/screens/useOutputStatuses', () => ({
  useOutputStatuses: () => fixture.statuses,
}));
vi.mock('@renderer/platform/ScreenSummaries', () => ({
  useScreenSummaries: () => [
    {id: 'stage', statusLabel: '무대 화면'},
    {id: 'stream', statusLabel: '방송 자막'},
  ],
}));
afterEach(() => {
  cleanup();
  fixture.statuses = {};
  identity.unavailable = false;
});

describe('StatusBar', () => {
  it('reports whether the active NDI path uses hardware acceleration', () => {
    fixture.statuses = {
      stream: {
        placement: 'ndi',
        renderer: 'running',
        fps: 30,
        fpsLow: false,
        ndiAcceleration: 'hardware',
      },
    };
    const view = render(<StatusBar />);
    expect(
      Array.from(screen.getByRole('status').children, item => item.textContent),
    ).toEqual(['방송 자막 NDI 30fps', '하드웨어 가속']);
    fixture.statuses = {
      stream: {
        ...fixture.statuses['stream'],
        placement: 'ndi',
        renderer: 'running',
        fps: 30,
        fpsLow: false,
        ndiAcceleration: 'bitmap',
        ndiAccelerationReason: 'no-texture',
      },
    };
    view.rerender(<StatusBar />);
    expect(
      Array.from(screen.getByRole('status').children, item => item.textContent),
    ).toEqual(['방송 자막 NDI 30fps', '하드웨어 가속 안 됨']);
  });
  it('shows identity fallback as quiet text and clears it when available', () => {
    identity.unavailable = true;
    const {rerender} = render(<StatusBar />);
    expect(screen.getByRole('status').textContent).toBe(
      '모니터 정보 확인 안 됨',
    );
    expect(screen.queryByRole('alert')).toBeNull();
    identity.unavailable = false;
    rerender(<StatusBar />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('shows the window fallback while control occupies the target monitor', () => {
    fixture.statuses = {
      stage: {
        placement: 'window',
        controlConflict: true,
        monitor: 1,
        renderer: 'running',
        fps: null,
        fpsLow: false,
      },
    };
    render(<StatusBar />);
    expect(screen.getByRole('status').textContent).toBe(
      '무대 화면: 모니터 1에 컨트롤 창이 있어 창으로 표시 중',
    );
  });
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
      '무대 화면 창으로 표시 중',
    );
    expect(screen.getByRole('status').textContent).toContain(
      '방송 자막 프레임 낮음 (41fps)',
    );
    fixture.statuses = {};
    view.rerender(<StatusBar />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('shows standby while the recovery decision is pending', () => {
    const view = render(<StatusBar standby />);
    expect(screen.getByRole('status').textContent).toBe('대기');
    view.rerender(<StatusBar standby={false} />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('shows saving and failure messages while those states last', () => {
    const view = render(<StatusBar saveState="saving" />);
    expect(screen.getByRole('status').textContent).toBe(
      '저장을 시도하는 중...',
    );
    view.rerender(<StatusBar saveState="failed" />);
    expect(screen.getByRole('status').textContent).toBe('저장하지 못함');
    view.rerender(<StatusBar />);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('announces a failed save as an alert and keeps the rest polite', () => {
    const view = render(<StatusBar saveState="saving" />);
    expect(screen.queryByRole('alert')).toBeNull();
    view.rerender(<StatusBar saveState="failed" />);
    expect(screen.getByRole('alert').textContent).toBe('저장하지 못함');
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
    expect(css).toMatch(
      /\.bar::-webkit-scrollbar\s*\{\s*height:\s*var\(--size-scrollbar-thumb\)/,
    );
    const tokens = readFileSync('src/renderer/src/styles/tokens.css', 'utf8');
    expect(tokens).toMatch(/--size-scrollbar-thumb:\s*6px/);
    expect(tokens).toMatch(/--size-statusbar:\s*28px/);
    expect(tokens).toMatch(/--type-caption:\s*400 14px\/20px/);
  });
});
