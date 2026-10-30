import type {LlpApi} from '@contracts/ipc/api';
import type {LiveState} from '@core/live/state';
import {
  isKnownQuickItem,
  type KnownQuickItem,
  type QuickItem,
} from '@core/schema/quick';
import {sendLive, useLive} from '@renderer/platform/live';
import {selectTile, useShow} from '@renderer/state/show';
import {openLibrarySong} from '@renderer/state/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from '@renderer/state/showOutput';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {openBiblePassage, showBiblePassage} from '../bible/actions';

export function quickItemUnavailable(item: QuickItem): string | undefined {
  if (!isKnownQuickItem(item)) return '이 버전에서 지원하지 않는 항목입니다';
  if (item.kind === 'black') return '검은 화면을 사용할 수 없습니다';
  if (
    item.kind === 'bible' &&
    (item.ref.split !== 'verse' ||
      item.ref.reference !== 'none' ||
      item.ref.translationName)
  ) {
    return '이 구절의 표시 설정을 사용할 수 없습니다';
  }
  return undefined;
}

export function quickItemOn(
  item: KnownQuickItem,
  live: LiveState | null,
): boolean | undefined {
  switch (item.kind) {
    case 'prop':
      return live?.layers.prop?.items
        ? live.layers.prop.items.some(prop => prop.propId === item.ref)
        : live?.layers.prop?.propId === item.ref;
    case 'timer':
      return live?.timers?.[item.ref]?.state === 'running';
    case 'black':
      return false;
    case 'song':
    case 'bible':
    case 'macro':
      return undefined;
    default: {
      const unhandled: never = item;
      return unhandled;
    }
  }
}

/** Cancels delayed execution after another choice, output, or panel cleanup. */
export function quickRunner(api: LlpApi, onProblem: (notice: Notice) => void) {
  let version = 0;
  const cancel = (): void => {
    version++;
  };
  const run = async (item: KnownQuickItem): Promise<void> => {
    const choice = ++version;
    const request = beginOutputRequest();
    const commandVersion = useLive.getState().commandVersion;
    const initial = useShow.getState();
    const current = (): boolean => {
      const view = useShow.getState();
      return (
        choice === version &&
        isOutputRequestCurrent(request, commandVersion) &&
        view.openItemId === initial.openItemId &&
        view.selectedTile === initial.selectedTile
      );
    };
    try {
      const unavailable = quickItemUnavailable(item);
      if (unavailable) throw new Error(unavailable);
      switch (item.kind) {
        case 'song': {
          const song = await withinLookupTimeout(() =>
            api.library.showSong({songId: item.ref}),
          );
          if (!current()) return;
          if (song === null || song.tiles.length === 0) {
            throw new Error('The quick song has no available slides');
          }
          openLibrarySong(song);
          const itemId = useShow.getState().openItemId;
          if (itemId === null) return;
          const slide = slideLayerOf({itemId, index: 0}, () => song.tiles);
          if (slide) sendLive({type: 'slide.show', slide});
          return;
        }
        case 'bible': {
          const reply = await withinLookupTimeout(() =>
            api.bible.lookup({
              translation: item.ref.translation,
              input: item.ref.ref,
            }),
          );
          if (!current()) return;
          if (!reply.result.ok) throw new Error(reply.result.error.message);
          openBiblePassage(reply.result.value, {
            verseNumbers: item.ref.verseNumbers,
          });
          selectTile(0);
          showBiblePassage(reply.result.value);
          return;
        }
        case 'prop':
          sendLive({
            type: 'prop.set',
            propId: item.ref,
            on: !quickItemOn(item, useLive.getState().state),
          });
          return;
        case 'timer':
          sendLive({
            type: quickItemOn(item, useLive.getState().state)
              ? 'timer.reset'
              : 'timer.start',
            timerId: item.ref,
          });
          return;
        case 'macro':
          sendLive({type: 'macro.run', macroId: item.ref});
          return;
        case 'black':
          throw new Error('The built-in black prop is unavailable');
        default: {
          const unhandled: never = item;
          return unhandled;
        }
      }
    } catch (cause) {
      api.log.write({
        level: 'error',
        message: 'Could not run the quick item',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (current()) {
        onProblem({
          key: 'quick:run',
          kind: 'warning',
          icon: 'warning',
          title: '항목 실행 실패',
          meta: [item.name],
          time: noticeTime(),
        });
      }
    }
  };
  return {run, cancel};
}
