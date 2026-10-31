import {useEffect, useRef, useState} from 'react';
import {createServiceId, type SongId} from '@core/schema/ids';
import {useShow} from '@renderer/session/show';
import {serviceOrderEditsFor} from '@renderer/session/serviceOrderEdits';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {LibraryApi} from './useLibrary';

export function useLibraryServices(
  api: LibraryApi,
  onProblem: (notice: Notice) => void,
) {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const active = useRef(false);
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
      const result = await serviceOrderEditsFor(api).insertSong(
        createServiceId(current.serviceId),
        song,
        null,
      );
      if (!result.ok && active.current) {
        onProblem({
          key: 'library:append',
          kind: 'warning',
          icon: 'warning',
          title:
            result.error.reason === 'write-failed'
              ? '예배 순서 저장 실패'
              : '예배 순서에 추가 실패',
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
      ? '열린 예배 순서가 없습니다'
      : readOnly
        ? '읽기 전용 예배 순서입니다'
        : busy
          ? '예배 순서에 추가하는 중'
          : undefined;
  return {disabledReason, busy, append};
}
