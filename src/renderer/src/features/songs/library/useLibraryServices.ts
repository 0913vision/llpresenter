import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useEffect, useRef, useState} from 'react';
import {createServiceId, type SongId} from '@core/schema/ids';
import {insertSelectedSong} from '@renderer/session/insertSelectedSong';
import {useShow} from '@renderer/session/show';
import {useOrderFull} from '@renderer/session/orderFull';
import {
  ORDER_FULL_REASON,
  orderFailureTitle,
  serviceOrderEditsFor,
} from '@renderer/session/serviceOrderEdits';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {LibraryApi} from './useLibrary';

export function useLibraryServices(
  api: LibraryApi,
  onProblem: (notice: Notice) => void,
) {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const full = useOrderFull();
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
      const result = await insertSelectedSong(
        serviceOrderEditsFor(api),
        createServiceId(current.serviceId),
        song,
      );
      if (!result.ok) {
        onProblem({
          key: 'library:append',
          kind: 'warning',
          icon: 'warning',
          title:
            result.error.reason === 'write-failed'
              ? '예배 저장 실패'
              : orderFailureTitle(result.error, '예배 순서에 추가 실패'),
          time: noticeTime(),
        });
      }
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const disabledReason =
    serviceId === null
      ? '열린 예배 없음'
      : readOnly
        ? NEWER_FILE_REASON
        : full
          ? ORDER_FULL_REASON
          : busy
            ? '예배 순서에 추가하는 중'
            : undefined;
  return {disabledReason, busy, append};
}
