import type {MediaId} from '@core/schema/ids';
import {createServiceItemId} from '@core/schema/ids';
import {newMediaItem} from '@core/services/quickAddMedia';
import {updateServiceBackground} from '@renderer/session/serviceBackground';
import {useShow} from '@renderer/session/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {useServiceOrderEditing} from './useServiceOrderEditing';
import {mediaDropReason} from './useServiceOrderDrag';

/** Validates media at drop time and applies an insertion or item background. */
export function useMediaOrderDrop({
  serviceId,
  editing,
  onProblem,
}: {
  readonly serviceId: string | null;
  readonly editing: ReturnType<typeof useServiceOrderEditing>;
  readonly onProblem: (notice: Notice) => void;
}) {
  return (
    mediaId: MediaId,
    before: string | null,
    target: string | null,
  ): void => {
    const api = window.llp;
    if (!api || serviceId === null) return;
    const service = serviceId;
    const report = (title: string) =>
      onProblem({
        key: 'service-order:media-drop',
        kind: 'warning',
        icon: 'warning',
        title,
        time: noticeTime(),
      });
    Promise.all([api.media.missing(), api.media.get()]).then(
      ([missing, document]) => {
        if (useShow.getState().serviceId !== service) return;
        const media = document.value.items.find(item => item.id === mediaId);
        const row =
          target === null
            ? undefined
            : useShow.getState().rows.find(item => item.id === target);
        const reason = mediaDropReason({
          media,
          missing: missing.includes(mediaId),
          target: row,
          asBackground: target !== null,
        });
        if (reason !== undefined) {
          report(reason);
          return;
        }
        if (target !== null) {
          updateServiceBackground(api, {
            serviceId: service,
            itemId: target,
            mediaId,
          }).then(
            result => {
              if (!result.ok) report('배경 변경 실패');
            },
            () => report('배경 변경 실패'),
          );
        } else {
          editing.run((edits, id) =>
            edits.insertItem(
              id,
              newMediaItem(mediaId),
              before === null ? null : createServiceItemId(before),
            ),
          );
        }
      },
      () => report('미디어 상태를 확인할 수 없습니다'),
    );
  };
}
