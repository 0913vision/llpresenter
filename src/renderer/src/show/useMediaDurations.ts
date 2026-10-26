import {useEffect, useState} from 'react';
import type {ServiceDocument} from '@shared/schema/contentDocuments';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import {isItemOfKind} from '@shared/schema/service';
import {noticeTime, type Notice} from '@renderer/ui/notices';

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
    let servicePushed = false;
    let mediaPushed = false;
    const update = (): void => {
      if (alive) setView({serviceId, durations: durationsOf(service, media)});
    };
    const stopService = api.services.subscribe(change => {
      if (!alive || change.serviceId !== serviceId) return;
      servicePushed = true;
      if (
        change.document !== null &&
        service !== null &&
        change.document.revision < service.revision
      ) {
        return;
      }
      service = change.document;
      update();
    });
    const stopMedia = api.media.subscribe(next => {
      if (!alive) return;
      mediaPushed = true;
      if (media !== null && next.revision < media.revision) return;
      media = next;
      update();
    });
    const report = (): void => {
      if (alive) {
        onProblem({
          key: 'service-order:details',
          kind: 'warning',
          icon: 'warning',
          title: '예배 순서 정보 불러오기 실패',
          time: noticeTime(),
        });
      }
    };
    api.services.get(serviceId).then(
      next => {
        if (!alive || servicePushed) return;
        service = next?.service.id === serviceId ? next : null;
        update();
      },
      () => {
        if (!servicePushed) report();
      },
    );
    api.media.get().then(
      next => {
        if (!alive || mediaPushed) return;
        media = next;
        update();
      },
      () => {
        if (!mediaPushed) report();
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
