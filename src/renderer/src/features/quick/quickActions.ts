import type {LlpApi} from '@contracts/ipc/api';
import type {LiveState} from '@core/schema/live';
import {QUICK_BIBLE_TRANSITION} from '@core/bible';
import {
  isKnownQuickItem,
  type KnownQuickItem,
  type QuickItem,
} from '@core/schema/quick';
import {
  beginQuickPassage,
  finishQuickPassage,
} from '@renderer/session/quickReturn';
import {sendLive, useLive} from '@renderer/session/live';
import {sendSlideOutput} from '@renderer/session/itemOutput';
import {outputSlideOf, selectTile, useShow} from '@renderer/session/show';
import {openLibrarySong} from '@renderer/session/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from '@renderer/session/showOutput';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {openBiblePassage, showBiblePassage} from '../bible/actions';

export function quickItemUnavailable(item: QuickItem): string | undefined {
  if (!isKnownQuickItem(item)) return '아직 없는 기능';
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
          const slide = outputSlideOf({itemId, index: 0});
          if (slide) sendSlideOutput(slide);
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
          const display = {
            verseNumbers: item.ref.verseNumbers,
            translationName: item.ref.translationName,
            review: false,
            transition: QUICK_BIBLE_TRANSITION,
          };
          beginQuickPassage();
          openBiblePassage(reply.result.value, display);
          selectTile(0);
          showBiblePassage(reply.result.value, display);
          finishQuickPassage();
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
        onProblem(warningNotice('quick:run', '항목 실행 실패', [item.name]));
      }
    }
  };
  return {run, cancel};
}
