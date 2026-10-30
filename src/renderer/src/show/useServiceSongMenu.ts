import {useEffect, useRef, useState} from 'react';
import type {SongDocument} from '@shared/schema/contentDocuments';
import {isItemOfKind, type ServiceItemOf} from '@shared/schema/service';
import {DEFAULT_ARRANGEMENT_NAME} from '@shared/schema/song';
import {arrangementOptions} from '@renderer/prep/editor/songArrangements';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {
  itemArrangementChange,
  updateServiceItem,
} from '@renderer/state/serviceItemUpdate';
import {useShow} from '@renderer/state/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {MenuEntry} from '@renderer/ui/menuModel';

interface SongMenuTarget {
  readonly id: string;
  readonly serviceId: string | null;
}

interface SongMenuData {
  readonly target: SongMenuTarget;
  readonly revision: number | null;
  readonly item: ServiceItemOf<'song'>;
  readonly document: SongDocument;
  readonly readOnly: boolean;
}

/** Reads only the clicked item's song; leaving the menu invalidates its reads. */
export function useServiceSongMenu(
  target: SongMenuTarget | null,
  onProblem: (notice: Notice) => void,
) {
  const api = window.llp;
  const revision = useShow(view => view.revision);
  const [data, setData] = useState<SongMenuData | null>(null);
  const [failure, setFailure] = useState<{
    target: SongMenuTarget;
    revision: number | null;
  } | null>(null);
  const writing = useRef(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const current = (): boolean => active;
    const serviceId = target?.serviceId;
    if (!target || !api || serviceId === null || serviceId === undefined) {
      return;
    }
    const read = async (): Promise<void> => {
      const service = await api.services.get(serviceId);
      const item = service?.service.order.find(item => item.id === target.id);
      if (!current()) return;
      if (
        service?.service.id !== serviceId ||
        !item ||
        !isItemOfKind(item, 'song')
      ) {
        setFailure({target, revision});
        return;
      }
      const document = await api.songs.get(item.song);
      if (!current()) return;
      if (document?.song.id !== item.song) {
        setFailure({target, revision});
        return;
      }
      setData({
        target,
        revision,
        item,
        document,
        readOnly: service.access === 'readOnly',
      });
    };
    read().catch((cause: unknown) => {
      if (!current()) return;
      api.log.write({
        level: 'error',
        message: 'Could not read the service item menu song',
        detail: String(cause),
      });
      setFailure({target, revision});
    });
    return () => {
      active = false;
    };
  }, [api, target, revision]);
  const current =
    data?.target === target && data.revision === revision ? data : null;
  const reason = !api
    ? '곡 조회 불가'
    : failure?.target === target && failure.revision === revision
      ? '곡 파일을 찾을 수 없습니다.'
      : !current
        ? '불러오는 중'
        : undefined;
  const choose = async (name: string): Promise<void> => {
    const serviceId = current?.target.serviceId;
    if (
      !api ||
      !current ||
      current.readOnly ||
      writing.current ||
      serviceId === null ||
      serviceId === undefined
    ) {
      return;
    }
    writing.current = true;
    setBusy(true);
    const change = itemArrangementChange(
      name === DEFAULT_ARRANGEMENT_NAME ? undefined : name,
    );
    try {
      await pendingWritesOf(api).run({
        write: async () => {
          const result = await updateServiceItem(api, {
            serviceId,
            itemId: current.item.id,
            change: item =>
              isItemOfKind(item, 'song') && item.song === current.item.song
                ? change(item)
                : null,
          });
          if (!result.ok) {
            onProblem({
              key: `service-item:${result.error.reason}`,
              kind: 'warning',
              icon: 'warning',
              title:
                result.error.reason === 'write-failed'
                  ? '예배 순서 저장 실패'
                  : '구성 변경 실패',
              time: noticeTime(),
            });
          }
          return result.ok || result.error.reason === 'write-failed';
        },
        refused: false,
        sent: value => value,
      });
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const selected = current?.document.song.arrangements?.some(
    item => item.name === current.item.arrangement,
  )
    ? current.item.arrangement
    : DEFAULT_ARRANGEMENT_NAME;
  const entries: readonly MenuEntry[] = current
    ? arrangementOptions(current.document.song).map(option => ({
        kind: 'item',
        id: option.value,
        label: option.label,
        check: 'radio',
        checked: option.value === selected,
        onSelect: () => {
          choose(option.value).catch((cause: unknown) =>
            api?.log.write({
              level: 'error',
              message: 'Could not change the service item arrangement',
              detail: String(cause),
            }),
          );
        },
      }))
    : [];
  return {
    entries,
    songId: current?.item.song,
    reason,
    locked: current?.readOnly === true || busy,
  };
}
