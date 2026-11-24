import {followLatest} from '@core/common/followLatest';
import {useEffect, useState} from 'react';
import type {ServiceDocument} from '@core/schema/services/contentDocuments';
import type {MediaDocument} from '@core/schema/media/mediaEdit';
import {isItemOfKind} from '@core/schema/services/service';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';

const MINUTE_SECONDS = 60;
const noDurations: Readonly<Record<string, string>> = {};

function durationsOf(
  service: ServiceDocument | null,
  media: MediaDocument | null,
) {
  const durations: Record<string, string> = {};
  const byId = new Map(
    media?.value.items.map(item => [item.id, item.duration]),
  );
  for (const item of service?.service.order ?? []) {
    if (!isItemOfKind(item, 'media')) continue;
    const duration = byId.get(item.media);
    if (duration === undefined) continue;
    const seconds = Math.floor(duration);
    durations[item.id] =
      `${Math.floor(seconds / MINUTE_SECONDS)}:${String(seconds % MINUTE_SECONDS).padStart(2, '0')}`;
  }
  return durations;
}

/** Reads durations only while 준비 has media rows and releases both feeds. */
export function useMediaDurations(
  serviceId: string | null,
  enabled: boolean,
  onProblem: (notice: Notice) => void,
) {
  const [view, setView] = useState<{
    serviceId: string;
    durations: Readonly<Record<string, string>>;
  } | null>(null);
  useEffect(() => {
    const api = window.llp;
    if (!enabled || serviceId === null || api === undefined) return undefined;
    let alive = true;
    let service: ServiceDocument | null = null;
    let media: MediaDocument | null = null;
    const update = (): void => {
      if (alive) setView({serviceId, durations: durationsOf(service, media)});
    };
    const report = (_cause: unknown, pushed: boolean): void => {
      if (alive && !pushed) {
        onProblem(
          warningNotice('service-order:details', '예배 정보 불러오기 실패'),
        );
      }
    };
    const stopService = followLatest<ServiceDocument | null>(
      {
        read: () =>
          api.services
            .get(serviceId)
            .then(next => (next?.service.id === serviceId ? next : null)),
        subscribe: listener =>
          api.services.subscribe(change => {
            if (change.serviceId === serviceId) listener(change.document);
          }),
      },
      {
        apply: next => {
          if (next !== null && service !== null) {
            if (next.revision < service.revision) return;
          }
          service = next;
          update();
        },
        failed: report,
      },
    );
    const stopMedia = followLatest<MediaDocument>(
      {read: () => api.media.get(), subscribe: api.media.subscribe},
      {
        apply: next => {
          if (media !== null && next.revision < media.revision) return;
          media = next;
          update();
        },
        failed: report,
      },
    );
    return () => {
      alive = false;
      stopService();
      stopMedia();
    };
  }, [enabled, serviceId, onProblem]);
  return enabled && view?.serviceId === serviceId
    ? view.durations
    : noDurations;
}
