import {act, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {BibleAiStatus} from '@renderer/features/bible/BibleAiStatus';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import type {BibleAiState} from '@core/schema/bibleAi';

describe('Bible AI status', () => {
  it('shows the state labels and keeps a late initial read from overwriting a push', async () => {
    let receive: (state: BibleAiState) => void = () => undefined;
    let finish: (state: BibleAiState) => void = () => undefined;
    let stopped = false;
    const api = mockLlpApi({
      bible: {
        getLlmStatus: () =>
          new Promise(resolve => {
            finish = resolve;
          }),
        onLlmStatus: listener => {
          receive = listener;
          return () => {
            stopped = true;
          };
        },
      },
    }).bible;
    const view = render(<BibleAiStatus api={api} />);
    expect(screen.getByText('AI 꺼짐')).toBeDefined();
    act(() => receive({status: 'starting', available: false, reason: ''}));
    expect(screen.getByText('AI 켜는 중')).toBeDefined();
    act(() => receive({status: 'ready', available: true, reason: ''}));
    await act(async () =>
      finish({status: 'missing', available: false, reason: ''}),
    );
    expect(screen.getByText('AI 켜짐')).toBeDefined();
    act(() =>
      receive({status: 'failed', available: false, reason: 'HTTP 500'}),
    );
    expect(screen.getByText('AI 꺼짐')).toBeDefined();
    expect(view.container.textContent).not.toContain('AI 대신');
    view.unmount();
    expect(stopped).toBe(true);
  });
});
