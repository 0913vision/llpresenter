import {useEffect, useEffectEvent, useRef, useState} from 'react';
import type {ServiceEntry} from '@core/schema/contentDocuments';
import type {ServiceId, SongId} from '@core/schema/ids';
import {serviceOrderEditsFor} from '@renderer/session/serviceOrderEdits';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {LibraryApi} from './useLibrary';

export function useLibraryServices(
  api: LibraryApi,
  onProblem: (notice: Notice) => void,
) {
  const [services, setServices] = useState<readonly ServiceEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const active = useRef(false);
  const reportProblem = useEffectEvent(onProblem);
  useEffect(() => {
    active.current = true;
    let current = true;
    let pushed = false;
    const stop = api.services.subscribeList(entries => {
      pushed = true;
      if (current) setServices(entries);
    });
    api.services.list().then(
      entries => {
        if (current && !pushed) setServices(entries);
      },
      (cause: unknown) => {
        console.error('Could not read services for the library menu:', cause);
        if (current) {
          reportProblem({
            key: 'library:services',
            kind: 'warning',
            icon: 'warning',
            title: '예배 순서 불러오기 실패',
            time: noticeTime(),
          });
        }
      },
    );
    return () => {
      active.current = false;
      current = false;
      stop();
    };
  }, [api]);

  const append = async (service: ServiceId, song: SongId): Promise<void> => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await serviceOrderEditsFor(api).insertSong(
        service,
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
  return {services, busy, append};
}
