import {cleanup, screen} from '@testing-library/react';
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

  it('shows a dot only for a screen on output', () => {
    useLive.setState({state: {...emptyLiveState(), outputs: {stage: true}}});
    const {container} = render(<StatusBar />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });
});
