import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {createServiceItemId, type MediaId} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {blankItem, pictureSlide} from '@core/slides';
import {slideMaking} from '@renderer/platform/themes';
import type {OpenServiceResult} from '@renderer/session/openService';
import {insertItems} from '@renderer/session/serviceOrderEdits';
import {useShow} from '@renderer/session/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';

/** One item with a slide for each picture. */
function imagesItem(fileName: string, media: readonly MediaId[]): ServiceItem {
  const making = slideMaking();
  return {
    ...blankItem(making),
    name: fileName.replace(/\.[^.]+$/u, ''),
    slides: media.map(id => pictureSlide(making, id)),
  };
}

function insertAfter(
  item: ServiceItem,
  selected: string | null,
): Promise<OpenServiceResult> {
  const row = useShow.getState().rows.find(entry => entry.id === selected);
  return insertItems(
    [item],
    row === undefined ? null : createServiceItemId(row.id),
  );
}

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
      const {serviceId} = view;
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
          if (useShow.getState().serviceId !== serviceId) {
            throw new Error('Service changed');
          }
          const item = imagesItem(fileName, media);
          const saved = await insertAfter(item, selected);
          if (!saved.ok && saved.error.reason !== 'write-failed') {
            throw new Error(saved.error.message);
          }
          notify(`PowerPoint 이미지 ${media.length}개를 가져왔습니다`, 'info');
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
