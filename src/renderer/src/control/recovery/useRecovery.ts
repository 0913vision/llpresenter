import {useEffect, useEffectEvent, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {
  RecoveryResult,
  RecoveryRowKind,
  RecoverySummary,
} from '@shared/schema/recovery';
import {noticeTime, type Notice} from '@renderer/ui/notices';

type Offer = NonNullable<RecoverySummary>;

const READ_FAILED_NOTICE: Omit<Notice, 'time' | 'actions'> = {
  key: 'recovery:read',
  kind: 'warning',
  icon: 'history',
  title: '복구할 출력 상태를 읽을 수 없음',
};

const FAILED_NOTICE: Omit<Notice, 'time'> = {
  key: 'recovery',
  kind: 'warning',
  icon: 'history',
  title: '출력 상태 복구 실패',
};

function logFailure(
  api: Pick<LlpApi, 'log'>,
  message: string,
  cause: unknown,
): void {
  api.log.write({
    level: 'error',
    message,
    detail: cause instanceof Error ? cause.message : String(cause),
  });
}

/**
 * The crash offer and its answer. Main holds the outputs off and the startup
 * 매크로 until one answer arrives; a stale or invalid selection reads the
 * offer again, a restore that changed nothing reports 출력 상태 복구 실패,
 * and a request that fails keeps the dialog so the operator can answer again.
 * An offer that can't be read reports a card whose 다시 시도 reads it again,
 * so main is never left waiting with no way to answer.
 */
export function useRecovery(
  api: Pick<LlpApi, 'recovery' | 'log'> | undefined,
  onProblem: (notice: Notice) => void,
) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [reads, setReads] = useState(0);
  const reportReadFailure = useEffectEvent(() => {
    onProblem({
      ...READ_FAILED_NOTICE,
      time: noticeTime(),
      actions: [
        {
          icon: 'refresh',
          label: '다시 시도',
          onSelect: () => setReads(count => count + 1),
        },
      ],
    });
  });

  useEffect(() => {
    if (api === undefined) return undefined;
    let active = true;
    api.recovery.summary().then(
      summary => {
        if (active) setOffer(summary);
      },
      (cause: unknown) => {
        logFailure(api, 'could not read the recovery offer', cause);
        if (active) reportReadFailure();
      },
    );
    return () => {
      active = false;
    };
  }, [api, reads]);

  const settle = async (result: RecoveryResult): Promise<void> => {
    if (result.ok || result.error.reason === 'unavailable') {
      setOffer(null);
      return;
    }
    if (result.error.reason === 'apply-failed') {
      setOffer(null);
      onProblem({...FAILED_NOTICE, time: noticeTime()});
      return;
    }
    setOffer((await api?.recovery.summary()) ?? null);
  };

  const answer = async (send: () => Promise<RecoveryResult>): Promise<void> => {
    if (api === undefined || busy) return;
    setBusy(true);
    try {
      await settle(await send());
    } catch (cause) {
      logFailure(api, 'could not answer the recovery offer', cause);
      onProblem({...FAILED_NOTICE, time: noticeTime()});
    } finally {
      setBusy(false);
    }
  };

  return {
    offer,
    busy,
    restore: (rows: readonly RecoveryRowKind[]): void => {
      if (offer === null || api === undefined) return;
      const {savedAt} = offer;
      answer(() => api.recovery.apply({savedAt, rows: [...rows]})).catch(
        (cause: unknown) => console.error('Recovery answer failed:', cause),
      );
    },
    startFresh: (): void => {
      if (api === undefined) return;
      answer(() => api.recovery.startFresh()).catch((cause: unknown) =>
        console.error('Recovery answer failed:', cause),
      );
    },
  };
}
