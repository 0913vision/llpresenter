import * as v from 'valibot';
import {noticePlaybackSchema} from '@shared/schema/overlayState';
import type {NoticePlayback} from '@shared/live';
import {MissingLiveTargetError} from '../commandErrors';
import {setLayer, type LiveHistory} from '../history';
import {noticePosition} from '../noticeClock';
import {defineSlice, type CommandOf, type SliceContext} from '../slice';

function start(
  history: LiveHistory,
  command: CommandOf<'notice.start'>,
  {settings, now}: SliceContext,
): LiveHistory {
  const document = settings?.get('notices');
  if (document?.name !== 'notices') {
    throw new Error('Notice settings are unavailable');
  }
  const notice = document.value.sets.find(item => item.id === command.noticeId);
  if (notice === undefined) {
    throw new MissingLiveTargetError({kind: 'notice', id: command.noticeId});
  }
  if (notice.media.length === 0) {
    throw new Error('A notice needs at least one image');
  }
  const old = history.state.layers.notice;
  const previous = old?.noticeId === notice.id ? old.playback : undefined;
  const unchangedSequence =
    previous?.interval === notice.interval &&
    previous.loop === notice.loop &&
    previous.media.length === notice.media.length &&
    previous.media.every((id, index) => id === notice.media[index]);
  const targets = [...new Set(notice.targets)];
  if (
    unchangedSequence &&
    previous.pausedAt === null &&
    command.position === undefined &&
    previous.targets.length === targets.length &&
    previous.targets.every((id, index) => id === targets[index])
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
  return setLayer(history, 'notice', {
    noticeId: notice.id,
    playback: v.parse(noticePlaybackSchema, playback),
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
    return setLayer(history, 'notice', {
      ...notice,
      playback: {
        ...notice.playback,
        pausedAt: Math.max(context.now, notice.playback.startedAt),
      },
    });
  },
});
