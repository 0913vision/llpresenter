import {useEffect, useEffectEvent, useRef, useState} from 'react';
import type {MediaId} from '@shared/schema/ids';
import type {
  MediaDocument,
  MediaImportProgress,
} from '@shared/schema/mediaEdit';
import {MEDIA_LIMITS} from '@shared/schema/mediaList';
import {sendLive} from '@renderer/state/live';
import type {Notice} from '@renderer/ui/notices';

export const MEDIA_IMPORT_UNAVAILABLE =
  '현재 버전에서는 미디어 파일을 가져올 수 없음';
export const MEDIA_RELINK_UNAVAILABLE =
  '현재 버전에서는 미디어 파일을 다시 연결할 수 없음';
type CopyJob = Extract<
  MediaImportProgress,
  {phase: 'queued' | 'copying' | 'analysing'}
>;

/** Follows the strip's documents and active copies; unmount releases both feeds. */
export function useMediaStrip(onProblem: (notice: Notice) => void) {
  const [document, setDocument] = useState<MediaDocument | null>(null);
  const [jobs, setJobs] = useState<readonly CopyJob[]>([]);
  const [missing, setMissing] = useState<ReadonlySet<MediaId>>(new Set());
  const canonical = useRef<MediaDocument | null>(null);
  const activeJobs = useRef(new Map<MediaId, CopyJob>());
  const missingIds = useRef(new Set<MediaId>());
  const alive = useRef(false);
  const reportFromFeed = useEffectEvent(onProblem);

  const problem = (cause: 'relink' | 'output', detail?: string): void => {
    if (!alive.current) return;
    const titles = {
      relink: '미디어 다시 연결할 수 없음',
      output: '미디어 출력 실패',
    };
    onProblem({
      key: `media-strip:${cause}`,
      kind: 'warning',
      icon: 'warning',
      title: titles[cause],
      time: new Date().toTimeString().slice(0, 5),
      ...(detail ? {meta: [detail]} : {}),
    });
  };

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
    const stopImports = api.media.subscribeImports(progress => {
      if (!active) return;
      if (
        progress.phase === 'queued' ||
        progress.phase === 'copying' ||
        progress.phase === 'analysing'
      ) {
        if (
          pending.has(progress.mediaId) ||
          pending.size < MEDIA_LIMITS.items
        ) {
          pending.set(progress.mediaId, progress);
        }
      } else {
        pending.delete(progress.mediaId);
        if (progress.phase === 'failed') {
          reportFromFeed({
            key: `media-strip:copy:${progress.mediaId}`,
            kind: 'warning',
            icon: 'warning',
            title: '미디어 복사 실패',
            time: new Date().toTimeString().slice(0, 5),
            meta: [progress.fileName],
          });
          api.log.write({
            level: 'error',
            message: 'Media copy failed',
            detail: progress.message,
          });
        }
      }
      setJobs([...pending.values()]);
    });
    api.media.get().then(accept, (cause: unknown) => {
      api.log.write({
        level: 'error',
        message: 'Could not load the media strip',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (active && canonical.current === null) {
        reportFromFeed({
          key: 'media-strip:load',
          kind: 'warning',
          icon: 'warning',
          title: '미디어 불러오기 실패',
          time: new Date().toTimeString().slice(0, 5),
        });
      }
    });
    return () => {
      active = false;
      alive.current = false;
      stopMedia();
      stopImports();
      pending.clear();
    };
  }, []);

  const markMissing = (id: MediaId, revision: number): void => {
    if (
      !alive.current ||
      canonical.current?.revision !== revision ||
      missingIds.current.has(id)
    ) {
      return;
    }
    missingIds.current.add(id);
    setMissing(new Set(missingIds.current));
  };
  const activate = (id: MediaId): void => {
    if (!alive.current || activeJobs.current.has(id)) return;
    const item = canonical.current?.value.items.find(item => item.id === id);
    if (!item || item.kind === 'audio') return;
    if (missingIds.current.has(id)) {
      problem('relink', MEDIA_RELINK_UNAVAILABLE);
      return;
    }
    try {
      sendLive({
        type: 'media.show',
        media: {mediaId: id, loop: item.props?.end !== 'stop'},
      });
    } catch (cause) {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not output the strip media',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      problem('output');
    }
  };
  return {document, jobs, missing, markMissing, activate};
}
