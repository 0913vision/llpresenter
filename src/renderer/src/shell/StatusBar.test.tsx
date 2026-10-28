import {cleanup, screen} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {useLive} from '@renderer/state/live';
import {StatusBar} from './StatusBar';
import {renderWithScreenSummaries as render} from '@renderer/shell/testing/screenSummaries';

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
});

describe('StatusBar', () => {
  it('uses readable status text and a hollow off dot', () => {
    const statusCss = readFileSync(
      'src/renderer/src/shell/StatusBar.module.css',
      'utf8',
    );
    const tokensCss = readFileSync(
      'src/renderer/src/styles/tokens.css',
      'utf8',
    );
    expect(statusCss).toMatch(/\.bar\s*\{[^}]*color:\s*var\(--text-3\)/s);
    expect(statusCss).toMatch(
      /\.off\s+\.dot\s*\{[^}]*border:\s*1px solid var\(--text-3\)/s,
    );
    expect(statusCss).toMatch(
      /\.off\s+\.dot\s*\{[^}]*background:\s*transparent/s,
    );
    const color = (name: string): number => {
      const hex = new RegExp(`--${name}: #([0-9a-f]{6})`).exec(tokensCss)?.[1];
      if (hex === undefined) throw new Error(`Missing ${name}`);
      const rgb = [0, 2, 4].map(
        index => parseInt(hex.slice(index, index + 2), 16) / 255,
      );
      const linear = rgb.map(value =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
      return (
        0.2126 * (linear[0] ?? 0) +
        0.7152 * (linear[1] ?? 0) +
        0.0722 * (linear[2] ?? 0)
      );
    };
    expect(
      (color('text-3') + 0.05) / (color('bg-app') + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('is a status region with the three screens in order', () => {
    render(<StatusBar />);
    const bar = screen.getByRole('status');
    expect(bar.textContent).toBe('본 화면무대 화면방송 자막');
  });

  it('keeps no focusable part', () => {
    render(<StatusBar />);
    expect(
      screen.getByRole('status').querySelectorAll('button, a, input'),
    ).toHaveLength(0);
  });

  it('distinguishes on and off screens with filled and hollow dots', () => {
    useLive.setState({state: {...emptyLiveState(), outputs: {stage: true}}});
    const {container} = render(<StatusBar />);
    const on = screen.getByRole('img', {name: '무대 화면 출력 켜짐'});
    const off = screen.getByRole('img', {name: '본 화면 출력 꺼짐'});
    expect(on.className).not.toContain('off');
    expect(off.className).toContain('off');
    expect(on.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(off.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});
