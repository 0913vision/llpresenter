import {parseNoticePlayback} from '@core/schema/overlayState';
import type {NoticePlayback} from '@core/live/state';
import {MissingLiveTargetError} from '../commandErrors';
import {setLayer, updateLayer, type LiveHistory} from '../history';
import {noticePosition} from '@core/overlays/noticeClock';
import {defineSlice, type CommandOf, type SliceContext} from '../slice';

function start(
  history: LiveHistory,
  command: CommandOf<'notice.start'>,
  {settings, now, reject}: SliceContext,
): LiveHistory {
  const document = settings?.get('notices');
  if (document?.name !== 'notices') {
    throw new Error('Notice settings are unavailable');
  }
  const notice = document.value.sets.find(item => item.id === command.noticeId);
  if (notice === undefined) {
    throw new MissingLiveTargetError({kind: 'notice', id: command.noticeId});
  }
  const old = history.state.layers.notice;
  const previous = old?.noticeId === notice.id ? old.playback : undefined;
  const unchangedSequence =
    previous?.interval === notice.interval &&
    previous.loop === notice.loop &&
    previous.media.length === notice.media.length &&
    previous.media.every((id, index) => id === notice.media[index]);
  const targets = [...new Set(notice.targets)];
  const unchangedTargets =
    previous?.targets.length === targets.length &&
    previous.targets.every((id, index) => id === targets[index]);
  if (
    unchangedSequence &&
    previous.pausedAt === null &&
    command.position === undefined &&
    unchangedTargets
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
      targets,
      startedAt:
        previous.startedAt +
        (previous.pausedAt === null ? 0 : Math.max(0, now - previous.pausedAt)),
      pausedAt: null,
    };
  } else {
    const currentMedia = previous?.media[noticePosition(previous, now)];
    const retainedPosition =
      currentMedia === undefined
        ? 0
        : Math.max(0, notice.media.indexOf(currentMedia));
    playback = {
      media: notice.media,
      position: command.position ?? retainedPosition,
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
