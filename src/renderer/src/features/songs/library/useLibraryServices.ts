import {useEffect, useRef, useState} from 'react';
import type {SongId} from '@core/schema/ids';
import {insertSelectedSong} from '@renderer/session/insertSelectedSong';
import {useShow} from '@renderer/session/show';
import {useOrderAddReason} from '@renderer/session/orderReasons';
import {orderFailureTitle} from '@renderer/session/serviceProblem';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import type {LibraryApi} from './useLibrary';

export function useLibraryServices(
  api: LibraryApi,
  onProblem: (notice: Notice) => void,
) {
  const addReason = useOrderAddReason();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const active = useRef(false);
  // NOTE(0913vision): A failure is reported even after the library is gone,
  // because the handler is the app's and the write was not undone.
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const append = async (song: SongId): Promise<void> => {
    const current = useShow.getState();
    if (pending.current || current.serviceId === null || current.readOnly) {
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const result = await insertSelectedSong(api, song);
      if (!result.ok) {
        onProblem(
          warningNotice(
            'library:append',
            result.error.reason === 'write-failed'
              ? '예배 저장 실패'
              : orderFailureTitle(result.error, '예배 순서에 추가 실패'),
          ),
        );
      }
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const disabledReason =
    addReason ?? (busy ? '예배 순서에 추가하는 중' : undefined);
  return {disabledReason, busy, append};
}
