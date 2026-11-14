import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {powerpointImageItem} from '@core/services/powerpointImages';
import {useShow} from '@renderer/session/show';
import {
  asServiceId,
  editApplied,
} from '@renderer/features/service/list/serviceEdits';
import {noticeTime, type Notice} from '@renderer/ui/notices';

/** Imports a complete deck before modifying the service. */
export function PowerPointImagesFlow({
  api,
  onDone,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly onDone: () => void;
  readonly onProblem: (notice: Notice) => void;
}) {
  useEffect(() => {
    let dispose = (): void => undefined;
    const timer = setTimeout(() => {
      const view = useShow.getState();
      const serviceId = asServiceId(view.serviceId);
      const selected = view.openItemId;
      const state = {cancelled: false, userCancelled: false};
      const stopped = (): boolean => state.cancelled || state.userCancelled;
      const notify = (
        title: string,
        kind: Notice['kind'],
        cancel = false,
      ): void =>
        onProblem({
          key: 'powerpoint:images',
          kind,
          icon: kind === 'warning' ? 'warning' : 'fileppt',
          title,
          time: noticeTime(),
          ...(cancel ? {persistent: true} : {}),
          ...(cancel
            ? {
                actions: [
                  {
                    icon: 'close',
                    label: '취소',
                    onSelect: () => {
                      state.userCancelled = true;
                      api.powerpoint.cancelImages().catch(() => undefined);
                    },
                  },
                ],
              }
            : {}),
        });
      if (!serviceId || view.readOnly) {
        notify('열린 예배가 필요합니다', 'warning');
        onDone();
        return;
      }
      const unsubscribe = api.powerpoint.subscribeImageProgress(
        ({done, total}) =>
          notify(
            `PowerPoint 이미지로 가져오는 중 (${done} / ${total})`,
            'info',
            true,
          ),
      );
      notify('PowerPoint 이미지로 가져오는 중', 'info', true);
      void (async () => {
        const result = await api.powerpoint.images();
        unsubscribe();
        if (!result.ok) {
          if (!stopped()) {
            notify(result.message, 'warning');
          }
          return;
        }
        if (!result.value) {
          notify('PowerPoint 이미지 가져오기를 취소했습니다', 'info');
          return;
        }
        const {fileName, slides} = result.value;
        try {
          if (stopped()) return;
          notify('PowerPoint 이미지를 추가하는 중', 'info');
          const stored = await api.powerpoint.storeImages({
            paths: slides.map(slide => slide.path),
          });
          if (!stored.ok) throw new Error(stored.message);
          const media = stored.value;
          if (stopped()) return;
          for (let attempt = 0; attempt < 3; attempt++) {
            if (stopped()) return;
            const document = await api.services.get(serviceId);
            if (stopped()) return;
            if (!document || useShow.getState().serviceId !== serviceId) {
              throw new Error('Service changed');
            }
            const item = powerpointImageItem(fileName, media);
            const index = document.service.order.findIndex(
              entry => entry.id === selected,
            );
            const order = [...document.service.order];
            order.splice(index < 0 ? order.length : index + 1, 0, item);
            if (stopped()) return;
            const saved = await api.content.edit({
              type: 'service.update',
              service: {...document.service, order},
              baseRevision: document.revision,
            });
            if (editApplied(saved)) {
              notify(
                `PowerPoint 이미지 ${media.length}개를 가져왔습니다`,
                'info',
              );
              return;
            }
            if (saved.ok || saved.error.reason !== 'stale') {
              throw new Error('Service update failed');
            }
          }
          throw new Error('Service changed');
        } finally {
          await Promise.all(
            slides.map(slide => api.powerpoint.release({path: slide.path})),
          );
        }
      })()
        .catch(() => {
          if (!stopped()) {
            notify('PowerPoint 이미지 가져오기 실패', 'warning');
          }
        })
        .finally(() => {
          unsubscribe();
          if (state.userCancelled && !state.cancelled) {
            notify('PowerPoint 이미지 가져오기를 취소했습니다', 'info');
          }
          if (!state.cancelled) onDone();
        });
      dispose = () => {
        state.cancelled = true;
        unsubscribe();
        api.powerpoint.cancelImages().catch(() => undefined);
      };
    }, 0);
    return () => {
      clearTimeout(timer);
      dispose();
    };
  }, [api, onDone, onProblem]);
  return null;
}
