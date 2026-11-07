import {useEffect, useRef, useState} from 'react';
import type {SongDocument} from '@core/schema/contentDocuments';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {useShow} from '@renderer/session/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {usageMeta} from '@renderer/ui/usageText';
import {createServiceId} from '@core/schema/ids';
import type {Revision} from '@core/schema/contentDocuments';

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
  readonly serviceRevision: Revision;
  readonly usedBy: number;
}

/** Reads only the clicked item's song; leaving the menu invalidates its reads. */
export function useServiceSongMenu(
  target: SongMenuTarget | null,
  onProblem: (notice: Notice) => void,
  beforeSave?: () => Promise<number | null>,
) {
  const api = window.llp;
  const revision = useShow(view => view.revision);
  const [data, setData] = useState<SongMenuData | null>(null);
  const [failure, setFailure] = useState<{
    target: SongMenuTarget;
    revision: number | null;
  } | null>(null);
  const [question, setQuestion] = useState<{
    data: SongMenuData;
    save: boolean;
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
      const usedBy =
        (await api.songs.list()).find(entry => entry.id === item.song)?.usedBy
          .length ?? 0;
      if (!current()) return;
      setData({
        target,
        revision,
        item,
        document,
        serviceRevision: service.revision,
        usedBy,
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
    ? '곡을 불러올 수 없습니다'
    : failure?.target === target && failure.revision === revision
      ? '곡 파일을 찾을 수 없습니다'
      : !current
        ? '불러오는 중'
        : undefined;
  const transfer = async (): Promise<void> => {
    if (question === null || api === undefined || writing.current) return;
    const captured = question.data;
    const serviceId = captured.target.serviceId;
    if (serviceId === null) return;
    writing.current = true;
    setBusy(true);
    try {
      const serviceRevision =
        question.save && beforeSave !== undefined
          ? await beforeSave()
          : captured.serviceRevision;
      if (serviceRevision === null) return;
      await pendingWritesOf(api).run({
        write: async () => {
          const result = await api.content.edit({
            type: question.save
              ? 'service.song.saveToLibrary'
              : 'service.song.reloadFromLibrary',
            serviceId: createServiceId(serviceId),
            itemId: captured.item.id,
            baseRevision: serviceRevision,
            songRevision: captured.document.revision,
          });
          if (!result.ok) {
            onProblem({
              key: 'song-transfer',
              kind: 'warning',
              icon: 'warning',
              title: '곡 저장 또는 불러오기 실패',
              time: noticeTime(),
            });
          } else setQuestion(null);
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
  return {
    songId: current?.item.song,
    reason,
    locked: current?.readOnly === true || busy,
    save: () => {
      if (current !== null) setQuestion({data: current, save: true});
    },
    reload: () => {
      if (current !== null) setQuestion({data: current, save: false});
    },
    dialog:
      question === null ? null : (
        <AlertDialog
          icon="song"
          title={
            question.save
              ? `‘${question.data.document.song.title}’ 곡을 덮어쓸까요?`
              : '라이브러리에서 다시 불러올까요?'
          }
          meta={
            question.save ? usageMeta(question.data.usedBy, '예배') : undefined
          }
          onCancel={() => {
            if (!busy) setQuestion(null);
          }}
          actions={[
            {
              label: question.save ? '덮어쓰기' : '다시 불러오기',
              primary: true,
              disabled: busy,
              onSelect: () => {
                transfer().catch((error: unknown) =>
                  console.error('Could not transfer the song item', error),
                );
              },
            },
          ]}
        />
      ),
  };
}
