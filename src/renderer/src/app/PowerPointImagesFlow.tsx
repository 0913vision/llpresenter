import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {createServiceItemId, type MediaId} from '@core/schema/common/ids';
import type {ServiceItem} from '@core/schema/services/service';
import {blankItem, pictureSlide} from '@core/slides';
import {slideMaking} from '@renderer/platform/documents/themes';
import type {OpenServiceResult} from '@renderer/session/service/openService';
import {insertItems} from '@renderer/session/service/serviceOrderEdits';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import {useShow} from '@renderer/session/show/showStore';
import {powerPointFailureCard} from '@renderer/features/songs/import/powerPointFailure';

const STORE_FAILED = '그림을 미디어에 저장하지 못했습니다.';
const SERVICE_CHANGED = '가져오는 동안 열린 예배가 바뀌었습니다.';
const INSERT_FAILED = '예배 순서에 넣지 못했습니다.';

/** One item with a slide for each picture. */
function imagesItem(fileName: string, media: readonly MediaId[]): ServiceItem {
  const making = slideMaking();
  return {
    ...blankItem(making),
    name: fileName.replace(/\.[^.]+$/u, ''),
    slides: media.map(id => pictureSlide(making, id)),
  };
}

/**
 * Puts the item after the open one, or at the end when there is none or the
 * order no longer has it.
 */
async function insertAfter(
  item: ServiceItem,
  selected: string | null,
): Promise<OpenServiceResult> {
  const row = useShow.getState().rows.find(entry => entry.id === selected);
  if (row === undefined) return insertItems([item], null);
  const placed = await insertItems([item], createServiceItemId(row.id));
  return !placed.ok && placed.error.reason === 'not-found'
    ? insertItems([item], null)
    : placed;
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
        {
          cancel = false,
          meta,
        }: {cancel?: boolean; meta?: string | undefined} = {},
      ): void =>
        onProblem({
          key: 'powerpoint:images',
          kind,
          icon: kind === 'warning' ? 'warning' : 'fileppt',
          title,
          time: noticeTime(),
          ...(meta === undefined ? {} : {meta: [meta]}),
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
        notify('열린 예배가 필요합니다.', 'warning');
        onDone();
        return;
      }
      const unsubscribe = api.powerpoint.subscribeImageProgress(
        ({done, total}) =>
          notify(
            `PowerPoint 이미지로 가져오는 중 (${done} / ${total})`,
            'info',
            {cancel: true},
          ),
      );
      notify('PowerPoint 이미지로 가져오는 중', 'info', {cancel: true});
      // NOTE(0913vision): The step that runs, so a failure says where it
      // stopped (church Nov 25: the card named no cause).
      let step: string | undefined;
      void (async () => {
        const result = await api.powerpoint.images();
        unsubscribe();
        if (!result.ok) {
          if (stopped()) return;
          if (result.failure === undefined) notify(result.message, 'warning');
          else {
            const {title, meta} = powerPointFailureCard(
              result.failure,
              'slides',
            );
            notify(title, 'warning', {meta});
          }
          return;
        }
        if (!result.value) {
          notify('PowerPoint 이미지 가져오기를 취소했습니다.', 'info');
          return;
        }
        const {fileName, slides} = result.value;
        try {
          if (stopped()) return;
          notify('PowerPoint 이미지를 추가하는 중', 'info');
          step = STORE_FAILED;
          const stored = await api.powerpoint.storeImages({
            paths: slides.map(slide => slide.path),
          });
          if (!stored.ok) throw new Error(stored.message);
          const media = stored.value;
          if (stopped()) return;
          step = SERVICE_CHANGED;
          if (useShow.getState().serviceId !== serviceId) {
            throw new Error('Service changed');
          }
          step = INSERT_FAILED;
          const item = imagesItem(fileName, media);
          const saved = await insertAfter(item, selected);
          if (!saved.ok && saved.error.reason !== 'write-failed') {
            throw new Error(`${saved.error.reason}: ${saved.error.message}`);
          }
          step = undefined;
          notify(`PowerPoint 이미지 ${media.length}개를 가져왔습니다.`, 'info');
        } finally {
          await Promise.all(
            slides.map(slide => api.powerpoint.release({path: slide.path})),
          );
        }
      })()
        .catch((error: unknown) => {
          api.log.write({
            level: 'warn',
            message: 'PowerPoint images import failed',
            detail: `${step ?? 'after the import'}: ${String(error)}`,
          });
          if (!stopped()) {
            notify('PowerPoint 이미지 가져오기 실패', 'warning', {meta: step});
          }
        })
        .finally(() => {
          unsubscribe();
          if (state.userCancelled && !state.cancelled) {
            notify('PowerPoint 이미지 가져오기를 취소했습니다.', 'info');
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
