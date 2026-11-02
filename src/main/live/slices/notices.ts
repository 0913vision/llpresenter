import {parseNoticePlayback} from '@core/schema/overlayState';
import type {NoticePlayback} from '@core/live/state';
import {MissingLiveTargetError} from '../commandErrors';
import {setLayer, updateLayer, type LiveHistory} from '../history';
import {noticePosition} from '@core/overlays/noticeClock';
import {defineSlice, type CommandOf, type SliceContext} from '../slice';

function firstFrom(
  position: number,
  media: readonly string[],
  gone: readonly string[],
): number {
  const index = media.findIndex(
    (id, at) => at >= position && !gone.includes(id),
  );
  return index >= 0 ? index : media.findIndex(id => !gone.includes(id));
}

function start(
  history: LiveHistory,
  command: CommandOf<'notice.start'>,
  context: SliceContext,
): LiveHistory {
  const {settings, now, reject} = context;
  const document = settings?.get('notices');
  if (document?.name !== 'notices') {
    throw new Error('Notice settings are unavailable');
  }
  const notice = document.value.sets.find(item => item.id === command.noticeId);
  if (notice === undefined) {
    throw new MissingLiveTargetError({kind: 'notice', id: command.noticeId});
  }
  const library = context.audioMedia?.();
  const present =
    library === undefined
      ? undefined
      : new Set(library.items.map(item => item.id));
  const gone =
    present === undefined
      ? []
      : [...new Set(notice.media.filter(id => !present.has(id)))];
  const firstShown = notice.media.findIndex(id => !gone.includes(id));
  if (firstShown < 0) return history;
  const requested = command.position;
  if (requested !== undefined) {
    const id = notice.media[requested];
    if (id !== undefined && gone.includes(id)) return history;
  }
  const old = history.state.layers.notice;
  const previous = old?.noticeId === notice.id ? old.playback : undefined;
  const unchangedSequence =
    previous?.interval === notice.interval &&
    previous.loop === notice.loop &&
    previous.media.length === notice.media.length &&
    previous.media.every((id, index) => id === notice.media[index]);
  const sameGone =
    (previous?.gone ?? []).length === gone.length &&
    gone.every(id => previous?.gone?.includes(id));
  const targets = [...new Set(notice.targets)];
  const unchangedTargets =
    previous?.targets.length === targets.length &&
    previous.targets.every((id, index) => id === targets[index]);
  if (
    unchangedSequence &&
    previous.pausedAt === null &&
    command.position === undefined &&
    unchangedTargets &&
    sameGone
  ) {
    return history;
  }
  let playback: NoticePlayback;
  if (
    previous !== undefined &&
    command.position === undefined &&
    unchangedSequence
  ) {
    playback = {
      ...previous,
      ...(gone.length === 0 ? {} : {gone}),
      targets,
      startedAt:
        previous.startedAt +
        (previous.pausedAt === null ? 0 : Math.max(0, now - previous.pausedAt)),
      pausedAt: null,
    };
  } else {
    const shown =
      previous === undefined ? undefined : noticePosition(previous, now);
    const currentMedia =
      shown === undefined ? undefined : previous?.media[shown];
    // NOTE(0913vision): The showing image keeps its place when the set is
    // edited. When it left the set, the set continues where it stood.
    const kept =
      currentMedia === undefined ? -1 : notice.media.indexOf(currentMedia);
    const retainedPosition =
      kept >= 0
        ? kept
        : Math.min(shown ?? 0, Math.max(0, notice.media.length - 1));
    playback = {
      media: notice.media,
      ...(gone.length === 0 ? {} : {gone}),
      position:
        command.position ?? firstFrom(retainedPosition, notice.media, gone),
      interval: notice.interval,
      loop: notice.loop,
      targets,
      startedAt: now,
      pausedAt: null,
    };
  }
  const parsed = parseNoticePlayback(playback);
  if (!parsed.ok) return reject(parsed.error);
  const put =
    unchangedSequence && unchangedTargets && command.position === undefined
      ? updateLayer
      : setLayer;
  return put(history, 'notice', {
    noticeId: notice.id,
    playback: parsed.value,
  });
}

export const noticesSlice = defineSlice({
  commands: ['notice.start', 'notice.pause', 'notice.stop'],
  initial: {},
  reduce: (history, command, context) => {
    if (command.type === 'notice.start') {
      return start(history, command, context);
    }
    if (command.type === 'notice.stop') {
      return history.state.layers.notice === null
        ? history
        : setLayer(history, 'notice', null);
    }
    const notice = history.state.layers.notice;
    if (notice?.playback?.pausedAt !== null) {
      return history;
    }
    return updateLayer(history, 'notice', {
      ...notice,
      playback: {
        ...notice.playback,
        pausedAt: Math.max(context.now, notice.playback.startedAt),
      },
    });
  },
});
