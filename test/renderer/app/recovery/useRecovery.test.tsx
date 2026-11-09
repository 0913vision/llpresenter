import {act, renderHook, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {RecoveryResult, RecoverySummary} from '@core/schema/recovery';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sampleOffer} from '@fixtures/renderer/app/recovery/testing';
import {useRecovery} from '@renderer/app/recovery/useRecovery';
import type {Notice} from '@renderer/ui/notices';

const restored: RecoveryResult = {ok: true, value: null};

// NOTE(0913vision): Each read answers the next offer; an Error rejects it.
function setup(offers: ReadonlyArray<RecoverySummary | Error>) {
  const summary = vi.fn<LlpApi['recovery']['summary']>();
  for (const offer of offers) {
    if (offer instanceof Error) summary.mockRejectedValueOnce(offer);
    else summary.mockResolvedValueOnce(offer);
  }
  summary.mockResolvedValue(null);
  const apply = vi
    .fn<LlpApi['recovery']['apply']>()
    .mockResolvedValue(restored);
  const startFresh = vi
    .fn<LlpApi['recovery']['startFresh']>()
    .mockResolvedValue(restored);
  const write = vi.fn<LlpApi['log']['write']>();
  const onProblem = vi.fn<(notice: Notice) => void>();
  const api = mockLlpApi({
    recovery: {summary, apply, startFresh},
    log: {write},
  });
  const {result} = renderHook(() => useRecovery(api, onProblem));
  return {result, summary, apply, startFresh, write, onProblem};
}

describe('useRecovery', () => {
  it('offers nothing when main has nothing to restore', async () => {
    const {result, summary} = setup([null]);

    await waitFor(() => expect(summary).toHaveBeenCalledOnce());

    expect(result.current.offer).toBeNull();
  });

  it('restores the checked rows of the offer and closes it', async () => {
    const offer = sampleOffer();
    const {result, apply} = setup([offer]);
    await waitFor(() => expect(result.current.offer).toEqual(offer));

    act(() => result.current.restore(['outputs', 'slide', 'showing']));

    await waitFor(() => expect(result.current.offer).toBeNull());
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      savedAt: offer.savedAt,
      rows: ['outputs', 'slide', 'showing'],
    });
  });

  it('starts fresh and closes the offer', async () => {
    const {result, apply, startFresh} = setup([sampleOffer()]);
    await waitFor(() => expect(result.current.offer).not.toBeNull());

    act(() => result.current.startFresh());

    await waitFor(() => expect(result.current.offer).toBeNull());
    expect(startFresh).toHaveBeenCalledOnce();
    expect(apply).not.toHaveBeenCalled();
  });

  it('reads the offer again after a stale answer', async () => {
    const newer = sampleOffer(['outputs']);
    const {result, apply} = setup([sampleOffer(), newer]);
    apply.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Invented newer record'},
    });
    await waitFor(() => expect(result.current.offer).not.toBeNull());

    act(() => result.current.restore(['outputs']));

    await waitFor(() => expect(result.current.offer).toEqual(newer));
  });

  it('reloads the offer after a failed write and allows a successful retry', async () => {
    const offer = sampleOffer();
    const {result, summary, apply, onProblem} = setup([offer, offer]);
    apply.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'apply-failed', message: 'Invented failed durable write'},
    });
    await waitFor(() => expect(result.current.offer).not.toBeNull());

    act(() => result.current.restore(['outputs']));

    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.offer).toEqual(offer);
    expect(summary).toHaveBeenCalledTimes(2);
    expect(onProblem.mock.lastCall?.[0].title).toBe('복구 실패');

    act(() => result.current.restore(['outputs']));
    await waitFor(() => expect(result.current.offer).toBeNull());
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.lastCall?.[0]).toEqual({
      savedAt: offer.savedAt,
      rows: ['outputs'],
    });
  });

  it('closes a consumed offer when starting fresh reports a startup failure', async () => {
    const {result, startFresh, onProblem} = setup([sampleOffer(), null]);
    startFresh.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'apply-failed', message: 'Invented startup failure'},
    });
    await waitFor(() => expect(result.current.offer).not.toBeNull());
    act(() => result.current.startFresh());
    await waitFor(() => expect(result.current.offer).toBeNull());
    expect(onProblem.mock.lastCall?.[0].title).toBe('복구 실패');
  });

  it('keeps the offer and warns when the answer cannot be sent', async () => {
    const {result, startFresh, write, onProblem} = setup([sampleOffer()]);
    startFresh.mockRejectedValueOnce(new Error('Invented closed channel'));
    await waitFor(() => expect(result.current.offer).not.toBeNull());

    act(() => result.current.startFresh());

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(onProblem.mock.lastCall?.[0].title).toBe('복구 실패');
    expect(write.mock.lastCall?.[0].message).toBe(
      'could not answer the recovery offer',
    );
    expect(result.current.offer).not.toBeNull();
  });

  it('reports an offer that cannot be read and reads it again with 다시 시도', async () => {
    const offer = sampleOffer();
    const {result, summary, onProblem} = setup([
      new Error('Invented closed channel'),
      offer,
    ]);
    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
    const notice = onProblem.mock.lastCall?.[0];
    expect(notice?.title).toBe('복구 항목 읽기 실패');

    act(() => notice?.actions?.[0]?.onSelect());

    await waitFor(() => expect(result.current.offer).toEqual(offer));
    expect(summary).toHaveBeenCalledTimes(2);
  });
});
