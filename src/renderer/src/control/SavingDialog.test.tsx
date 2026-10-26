import {act, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import type {AppFlushRequest} from '@shared/schema/appFlush';
import {createAppFlushRequestId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {CloseFlush} from './closeFlush';
import {SavingDialog} from './SavingDialog';

it('shows nothing, then 저장 중 with 다시 시도 off, then 저장할 수 없음 with 다시 시도 as the default', async () => {
  let request: (value: AppFlushRequest) => void = () => undefined;
  let finish: (value: boolean) => void = () => undefined;
  const closeAnyway = vi.fn();
  const model = new CloseFlush({
    api: fakeLlpApi({
      app: {
        subscribeFlushRequests: listener => {
          request = listener;
          return () => undefined;
        },
        closeAnyway,
      },
    }),
    flush: () =>
      new Promise<boolean>(resolve => {
        finish = resolve;
      }),
  });
  const view = render(<SavingDialog closeFlush={model} />);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  act(() => {
    request({
      requestId: createAppFlushRequestId(
        'f96d50a7-cd64-4f70-9b82-930415263748',
      ),
    });
    model.retry();
  });
  expect(screen.getByRole('alertdialog', {name: '저장 중'})).toBeTruthy();
  const waiting = screen.getByRole('button', {name: '다시 시도'});
  expect(waiting.getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(waiting);
  await act(async () => {
    finish(false);
    await Promise.resolve();
  });
  expect(
    screen.getByRole('alertdialog', {name: '저장할 수 없음'}),
  ).toBeTruthy();
  const retry = screen.getByRole('button', {name: '다시 시도'});
  expect(retry.getAttribute('aria-disabled')).toBeNull();
  expect(document.activeElement).toBe(retry);
  const force = screen.getByRole('button', {name: '강제로 닫기'});
  force.click();
  expect(closeAnyway).toHaveBeenCalledOnce();
  expect((await hoverForTooltip(force))?.textContent).toBe(
    '저장하지 못한 편집은 사라집니다',
  );
  resetTooltips();
  view.unmount();
  model.dispose();
});
