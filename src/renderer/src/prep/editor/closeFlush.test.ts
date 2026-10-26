import {describe, expect, it, vi} from 'vitest';
import type {AppFlushRequest} from '@shared/schema/appFlush';
import {createAppFlushRequestId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import type {Notice} from '@renderer/ui/notices';
import {answerCloseFlush, CLOSE_WARNING_KEY} from './closeFlush';

const requestId = createAppFlushRequestId(
  'b52f1d63-8f20-4b3c-9d4e-5f6071829304',
);

function setup(flush: () => Promise<boolean>) {
  const listeners = new Set<(request: AppFlushRequest) => void>();
  const flushDone = vi.fn();
  const closeAnyway = vi.fn();
  const write = vi.fn();
  const api = fakeLlpApi({
    app: {
      subscribeFlushRequests: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      flushDone,
      closeAnyway,
    },
    log: {write},
  });
  const report = vi.fn<(notice: Notice) => void>();
  const stop = answerCloseFlush({api, flush, report});
  const request = () => {
    for (const listener of listeners) listener({requestId});
  };
  return {listeners, flushDone, closeAnyway, write, report, stop, request};
}

describe('close flush answer', () => {
  it('replies with the request id after a successful flush and warns about nothing', async () => {
    const {flushDone, report, request} = setup(() => Promise.resolve(true));
    request();
    await vi.waitFor(() => {
      expect(flushDone).toHaveBeenCalledExactlyOnceWith({
        requestId,
        result: true,
      });
    });
    expect(report).not.toHaveBeenCalled();
  });

  it('replies false to a refused flush and offers 그래도 닫기', async () => {
    const {flushDone, closeAnyway, report, request} = setup(() =>
      Promise.resolve(false),
    );
    request();
    await vi.waitFor(() => expect(report).toHaveBeenCalledOnce());
    expect(flushDone).toHaveBeenCalledExactlyOnceWith({
      requestId,
      result: false,
    });
    const notice = report.mock.calls[0]?.[0];
    expect(notice).toMatchObject({
      key: CLOSE_WARNING_KEY,
      kind: 'warning',
      title: '편집 내용 저장 실패',
    });
    expect(notice?.actions?.map(action => action.label)).toEqual([
      '그래도 닫기',
    ]);
    expect(closeAnyway).not.toHaveBeenCalled();
    notice?.actions?.[0]?.onSelect();
    expect(closeAnyway).toHaveBeenCalledOnce();
  });

  it('logs a failing flush and answers it as refused', async () => {
    const {flushDone, write, report, request} = setup(() =>
      Promise.reject(new Error('Invented flush failure')),
    );
    request();
    await vi.waitFor(() => expect(report).toHaveBeenCalledOnce());
    expect(flushDone).toHaveBeenCalledExactlyOnceWith({
      requestId,
      result: false,
    });
    expect(write).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        level: 'error',
        message: 'could not flush the editor before closing',
      }),
    );
  });

  it('stops answering when released', () => {
    const {listeners, stop} = setup(() => Promise.resolve(true));
    expect(listeners.size).toBe(1);
    stop();
    expect(listeners.size).toBe(0);
  });
});
