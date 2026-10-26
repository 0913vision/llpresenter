import {useCallback, useEffect, useEffectEvent, useRef, useState} from 'react';
import type {MediaId} from '@shared/schema/ids';
import {mediaLoops} from '@shared/mediaEndRule';
import type {
  MediaDocument,
  MediaImportProgress,
  MediaImportRequest,
} from '@shared/schema/mediaEdit';
import {requestMediaImport} from '@renderer/prep/media/mediaImport';
import {sendLive} from '@renderer/state/live';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {updateActiveCopies, type CopyJob} from './mediaCopyJobs';

export const UNNAMED_MEDIA = '이름 없는 미디어';

function warningNotice(
  key: string,
  title: string,
  meta?: readonly string[],
): Notice {
  return {
    key,
    kind: 'warning',
    icon: 'warning',
    title,
    time: noticeTime(),
    meta,
  };
}

/** Follows the strip's documents and active copies; unmount releases both feeds. */
export function useMediaStrip(onProblem: (notice: Notice) => void) {
  const [document, setDocument] = useState<MediaDocument | null>(null);
  const [jobs, setJobs] = useState<readonly CopyJob[]>([]);
  const [missing, setMissing] = useState<ReadonlySet<MediaId>>(new Set());
  const [destinations, setDestinations] = useState<
    ReadonlyMap<MediaId, string>
  >(new Map());
  const importDestinations = useRef(new Map<MediaId, string>());
  const canonical = useRef<MediaDocument | null>(null);
  const activeJobs = useRef(new Map<MediaId, CopyJob>());
  const missingIds = useRef(new Set<MediaId>());
  const alive = useRef(false);
  const reportFromFeed = useEffectEvent(onProblem);

  const followProgress = (progress: MediaImportProgress): void => {
    const changed = updateActiveCopies(activeJobs.current, progress);
    if (progress.phase === 'failed') {
      onProblem(
        warningNotice(
          `media-strip:copy:${progress.mediaId}`,
          '미디어 복사 실패',
          [progress.fileName],
        ),
      );
      window.llp?.log.write({
        level: 'error',
        message: 'Media copy failed',
        detail: progress.message,
      });
    }
    if (changed) setJobs([...activeJobs.current.values()]);
    if (
      !activeJobs.current.has(progress.mediaId) &&
      importDestinations.current.delete(progress.mediaId)
    ) {
      setDestinations(new Map(importDestinations.current));
    }
  };
  const receiveProgress = useEffectEvent(followProgress);

  useEffect(() => {
    const api = window.llp;
    if (!api) return undefined;
    let active = true;
    alive.current = true;
    const accept = (next: MediaDocument): void => {
      if (!active || next.revision <= (canonical.current?.revision ?? -1)) {
        return;
      }
      canonical.current = next;
      missingIds.current.clear();
      setMissing(new Set());
      setDocument(next);
    };
    const stopMedia = api.media.subscribe(accept);
    const pending = activeJobs.current;
    const destinations = importDestinations.current;
    const stopImports = api.media.subscribeImports(progress => {
      if (active) receiveProgress(progress);
    });
    const read = async (): Promise<void> => {
      try {
        accept(await api.media.get());
      } catch (cause) {
        api.log.write({
          level: 'error',
          message: 'Could not load the media strip',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        if (active && canonical.current === null) {
          reportFromFeed(
            warningNotice('media-strip:load', '미디어 불러오기 실패'),
          );
        }
      }
    };
    read().catch((cause: unknown) => {
      console.error('Media strip load callback failed:', cause);
    });
    return () => {
      active = false;
      alive.current = false;
      stopMedia();
      stopImports();
      pending.clear();
      destinations.clear();
    };
  }, []);

  const markMissing = useCallback((id: MediaId, revision: number): void => {
    if (
      !alive.current ||
      canonical.current?.revision !== revision ||
      missingIds.current.has(id)
    ) {
      return;
    }
    missingIds.current.add(id);
    setMissing(new Set(missingIds.current));
  }, []);
  const activate = (id: MediaId): void => {
    if (!alive.current || activeJobs.current.has(id)) return;
    const item = canonical.current?.value.items.find(item => item.id === id);
    if (!item || item.kind === 'audio') return;
    if (missingIds.current.has(id)) {
      onProblem(
        warningNotice('media-strip:relink', '미디어 다시 연결할 수 없음', [
          item.name || UNNAMED_MEDIA,
        ]),
      );
      return;
    }
    try {
      sendLive({
        type: 'media.show',
        media: {mediaId: id, loop: mediaLoops(item)},
      });
    } catch (cause) {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not output the strip media',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      onProblem(warningNotice('media-strip:output', '미디어 출력 실패'));
    }
  };
  const importMedia = async (
    playlist: MediaImportRequest['playlist'],
  ): Promise<void> => {
    const api = window.llp;
    const isActive = (): boolean => alive.current;
    if (!api || !isActive()) return;
    const queued = await requestMediaImport({
      api,
      source: {kind: 'dialog'},
      playlist,
      onProblem: notice => {
        if (alive.current) onProblem(notice);
      },
    });
    if (!alive.current || queued === null) return;
    for (const progress of queued) {
      followProgress(progress);
      if (playlist !== null && activeJobs.current.has(progress.mediaId)) {
        importDestinations.current.set(progress.mediaId, playlist.id);
      }
    }
    setDestinations(new Map(importDestinations.current));
  };
  return {
    document,
    jobs,
    missing,
    markMissing,
    activate,
    importMedia,
    destinations,
  };
}
