import {logFailure} from '@renderer/platform/logFailure';
import {useEffect, useRef, useState} from 'react';
import type {
  SongDocument,
  Revision,
} from '@core/schema/services/contentDocuments';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/services/service';
import {pendingWritesOf} from '@renderer/platform/documents/pendingWrites';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {AlertDialog} from '@renderer/ui/popups/AlertDialog';
import {createServiceId} from '@core/schema/common/ids';
import type {LlpApi} from '@contracts/ipc/api';
import {useShow} from '@renderer/session/show/showStore';
import {openInPrep} from '@renderer/session/prepTarget';
import {
  openSongDraftWithItem,
  requestLeaveSong,
} from '@renderer/features/songs/songDraft';

interface SongMenuTarget {
  readonly id: string;
  readonly serviceId: string | null;
  readonly api?: LlpApi | undefined;
}

interface SongMenuData {
  readonly target: SongMenuTarget;
  readonly revision: number | null;
  readonly item: ServiceItemOf<'song'>;
  readonly document: SongDocument;
  readonly readOnly: boolean;
  readonly serviceRevision: Revision;
}

async function readSongMenu(
  api: LlpApi,
  target: SongMenuTarget,
  revision: number | null,
): Promise<SongMenuData | null> {
  const serviceId = target.serviceId;
  if (serviceId === null) return null;
  const service = await api.services.get(serviceId);
  const item = service?.service.order.find(entry => entry.id === target.id);
  if (
    service?.service.id !== serviceId ||
    !item ||
    !isItemOfKind(item, 'song')
  ) {
    return null;
  }
  const document = await api.songs.get(item.song);
  if (document?.song.id !== item.song) return null;
  return {
    target,
    revision,
    item,
    document,
    serviceRevision: service.revision,
    readOnly: service.access === 'readOnly',
  };
}
/**
 * Opens the song of a song item in the song editor with the item's slides,
 * its title slides left out, to be saved over the library song there (USER
 * Nov 25). The edits on their way are waited for and the item and the song
 * read again, so the editor gets the last edits.
 */
async function openItemInSongEditor(
  api: LlpApi,
  data: SongMenuData,
  onProblem: (notice: Notice) => void,
): Promise<void> {
  await pendingWritesOf(api).settle();
  const latest = await readSongMenu(api, data.target, data.revision);
  if (latest === null) {
    onProblem(warningNotice('song-transfer', '곡 열기 실패'));
    return;
  }
  requestLeaveSong(() => {
    openSongDraftWithItem(latest.document, latest.item.slides);
    openInPrep({kind: 'song'});
  });
}

/** Reads only the clicked item's song; leaving the menu invalidates its reads. */
export function useServiceSongMenu(
  target: SongMenuTarget | null,
  onProblem: (notice: Notice) => void,
) {
  const api = target?.api ?? window.llp;
  const revision = useShow(view => view.revision);
  const [data, setData] = useState<SongMenuData | null>(null);
  const [failure, setFailure] = useState<{
    target: SongMenuTarget;
    revision: number | null;
  } | null>(null);
  const [question, setQuestion] = useState<SongMenuData | null>(null);
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
      const result = await readSongMenu(api, target, revision);
      if (!current()) return;
      if (result === null) setFailure({target, revision});
      else setData(result);
    };
    read().catch((cause: unknown) => {
      if (!current()) return;
      logFailure(api, 'Could not read the service item menu song', cause);
      setFailure({target, revision});
    });
    return () => {
      active = false;
    };
  }, [api, target, revision]);
  const current =
    data?.target === target && data.revision === revision ? data : null;
  const reason = !api
    ? '곡을 불러올 수 없습니다.'
    : failure?.target === target && failure.revision === revision
      ? '곡 파일을 찾을 수 없습니다.'
      : !current
        ? '불러오는 중'
        : undefined;
  const transfer = async (): Promise<void> => {
    if (question === null || api === undefined || writing.current) return;
    const captured = question;
    const serviceId = captured.target.serviceId;
    if (serviceId === null) return;
    writing.current = true;
    setBusy(true);
    try {
      await pendingWritesOf(api).run({
        write: async () => {
          const result = await api.content.edit({
            type: 'service.song.reloadFromLibrary',
            serviceId: createServiceId(serviceId),
            itemId: captured.item.id,
            baseRevision: captured.serviceRevision,
            songRevision: captured.document.revision,
          });
          if (!result.ok) {
            onProblem(warningNotice('song-transfer', '곡 불러오기 실패'));
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
      if (current === null || api === undefined) return;
      openItemInSongEditor(api, current, onProblem).catch((error: unknown) =>
        logFailure(api, 'Could not open the song item in the editor', error),
      );
    },
    reload: () => {
      if (current !== null) setQuestion(current);
    },
    dialog:
      question === null ? null : (
        <AlertDialog
          icon="song"
          title="라이브러리에서 다시 불러올까요?"
          onCancel={() => {
            if (!busy) setQuestion(null);
          }}
          actions={[
            {
              label: '다시 불러오기',
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
