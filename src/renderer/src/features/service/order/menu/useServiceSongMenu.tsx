import {logFailure} from '@renderer/platform/logFailure';
import {useEffect, useRef, useState} from 'react';
import type {SongDocument} from '@core/schema/services/contentDocuments';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/services/service';
import {pendingWritesOf} from '@renderer/platform/documents/pendingWrites';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {AlertDialog} from '@renderer/ui/popups/AlertDialog';
import {songItemSlides} from '@core/slides';
import {editItem} from '@renderer/session/service/openService';
import {
  slideMaking,
  songItemOptions,
} from '@renderer/platform/documents/themes';
import type {LlpApi} from '@contracts/ipc/api';
import {useShow} from '@renderer/session/show/showStore';
import {openInPrep} from '@renderer/session/prepTarget';
import {
  openSongDraftWithItem,
  requestLeaveSong,
  useSongDraft,
} from '@renderer/features/songs/draft';
import {focusSlides, openDeckAt} from '@renderer/features/slides/deckSelection';

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
    // NOTE(0913vision): The first slide takes the selection and the slides
    // take the focus once the editor is drawn, so 실행 취소 goes to this song
    // and never to the 예배 순서 the menu was opened on (church, Nov 25).
    const first = useSongDraft.getState().draft?.song.slides[0];
    openDeckAt(latest.document.song.id, first?.id);
    openInPrep({kind: 'song'});
    requestAnimationFrame(() => requestAnimationFrame(focusSlides));
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
  /**
   * 라이브러리에서 다시 불러오기: the item gets the song as a new item would.
   * It is an edit of the 예배 순서 like any other, so 실행 취소 runs it back
   * and the steps before it stay in reach (issues-1125 R-1125-1).
   */
  const reloadItem = async (): Promise<void> => {
    if (question === null || api === undefined || writing.current) return;
    const captured = question;
    writing.current = true;
    setBusy(true);
    try {
      const document = await api.songs.get(captured.item.song);
      // NOTE(0913vision): The slides are made once, outside the change: the
      // edit runs its change again on the newest order, and new slide ids
      // each time would make the step look changed to 실행 취소.
      const slides =
        document === null
          ? null
          : songItemSlides(document.song, slideMaking(), songItemOptions());
      const result =
        slides === null
          ? null
          : await editItem(captured.item.id, item =>
              isItemOfKind(item, 'song') ? {...item, slides} : null,
            );
      if (result?.ok === true) setQuestion(null);
      else onProblem(warningNotice('song-transfer', '곡 불러오기 실패'));
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
          title="라이브러리에서 다시 불러오시겠습니까?"
          onCancel={() => {
            if (!busy) setQuestion(null);
          }}
          actions={[
            {
              label: '다시 불러오기',
              primary: true,
              disabled: busy,
              onSelect: () => {
                reloadItem().catch((error: unknown) =>
                  console.error('Could not transfer the song item', error),
                );
              },
            },
          ]}
        />
      ),
  };
}
