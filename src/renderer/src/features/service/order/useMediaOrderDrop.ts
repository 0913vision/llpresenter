import type {MediaId} from '@core/schema/ids';
import {createServiceItemId} from '@core/schema/ids';
import {newMediaItem} from '@core/services/quickAddMedia';
import {useShow} from '@renderer/session/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {PaletteEditing} from '../items/PaletteEditing';
import type {ServiceTableParts} from './serviceTableParts';
import {mediaDropReason} from './useServiceOrderDrag';

/** Validates media at drop time and applies an insertion or item background. */
export function useMediaOrderDrop({
  serviceId,
  runEdit,
  setBackground,
  onProblem,
}: {
  readonly serviceId: string | null;
  readonly runEdit: PaletteEditing['enqueueEdit'];
  readonly setBackground: ServiceTableParts['setBackground'];
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
    const validate = async (): Promise<boolean> => {
      try {
        const [missing, document] = await Promise.all([
          api.media.missing(),
          api.media.get(),
        ]);
        if (useShow.getState().serviceId !== service) return false;
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
          return false;
        }
        return true;
      } catch {
        report('미디어 상태를 확인할 수 없습니다');
        return false;
      }
    };
    if (target === null) {
      runEdit(async (edits, id) => {
        if (!(await validate())) return {ok: true, value: false};
        return edits.insertItem(
          id,
          newMediaItem(mediaId),
          before === null ? null : createServiceItemId(before),
        );
      });
      return;
    }
    validate()
      .then(valid => {
        if (valid && setBackground) {
          setBackground(service, target, mediaId).catch(() =>
            report('배경 변경 실패'),
          );
        }
      })
      .catch(() => report('배경 변경 실패'));
  };
}
