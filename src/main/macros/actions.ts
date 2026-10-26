import type {SingleLiveCommand} from '@shared/commands';
import {mediaLoops} from '@shared/mediaEndRule';
import {MissingLiveTargetError} from '../live/commandErrors';
import {defineMacroAction, MacroActionRegistry} from './actionRegistry';
import {fillMacroMessage} from './messageText';
import type {ActionContext, ActionResolution} from './types';

function command(value: SingleLiveCommand): ActionResolution {
  return {kind: 'commands', commands: [value]};
}

export function requireMacroTarget<T>(
  target: T | undefined,
  kind: string,
  id: string,
): T {
  if (target === undefined) throw new MissingLiveTargetError({kind, id});
  return target;
}

function screenExists(context: ActionContext, id: string): void {
  requireMacroTarget(
    context.catalog.screens.screens.find(screen => screen.id === id),
    'screen',
    id,
  );
}

export const macroActionHandlers = [
  defineMacroAction({
    kind: 'look',
    compile: (action, {catalog}) => {
      requireMacroTarget(
        catalog.looks.looks.find(item => item.id === action.look),
        'look',
        action.look,
      );
      return command({type: 'look.set', lookId: action.look});
    },
  }),
  defineMacroAction({
    kind: 'stageLayout',
    compile: (action, context) => {
      requireMacroTarget(
        context.catalog.layouts.layouts.find(item => item.id === action.layout),
        'stage-layout',
        action.layout,
      );
      if (action.screen !== undefined) screenExists(context, action.screen);
      return command({
        type: 'stage.layout.set',
        layoutId: action.layout,
        ...(action.screen === undefined ? {} : {screenId: action.screen}),
      });
    },
  }),
  defineMacroAction({
    kind: 'clearAll',
    compile: action =>
      command({
        type: 'layer.clear',
        target: 'all',
        ...(action.transition === undefined
          ? {}
          : {transition: action.transition}),
      }),
  }),
  defineMacroAction({
    kind: 'clearLayer',
    compile: (action, {catalog}) => {
      if ('layer' in action) {
        return command({
          type: 'layer.clear',
          target: action.layer,
          ...(action.transition === undefined
            ? {}
            : {transition: action.transition}),
        });
      }
      requireMacroTarget(
        catalog.props.props.find(item => item.id === action.prop),
        'prop',
        action.prop,
      );
      return command({
        type: 'overlay.clear',
        target: {kind: 'prop', propId: action.prop},
        ...(action.transition === undefined
          ? {}
          : {transition: action.transition}),
      });
    },
  }),
  defineMacroAction({
    kind: 'media',
    compile: (action, {catalog}) => {
      const item = requireMacroTarget(
        catalog.media.items.find(
          item => item.id === action.media && item.kind !== 'audio',
        ),
        'media',
        action.media,
      );
      return command({
        type: 'media.show',
        media: {mediaId: item.id, loop: mediaLoops(item)},
      });
    },
  }),
  defineMacroAction({
    kind: 'prop',
    compile: (action, {catalog, props}) => {
      requireMacroTarget(
        catalog.props.props.find(item => item.id === action.prop),
        'prop',
        action.prop,
      );
      return command({
        type: 'prop.set',
        propId: action.prop,
        on:
          action.mode === 'toggle'
            ? !props.has(action.prop)
            : action.mode === 'on',
      });
    },
  }),
  defineMacroAction({
    kind: 'message',
    compile: (action, context) => {
      const template = requireMacroTarget(
        context.catalog.messages.templates.find(
          item => item.id === action.template,
        ),
        'message-template',
        action.template,
      );
      if (action.targets !== 'all') {
        for (const id of action.targets) screenExists(context, id);
      }
      return command({
        type: 'message.send',
        text: fillMacroMessage(template, action.values),
        targets: action.targets,
        duration: action.duration,
      });
    },
  }),
  defineMacroAction({
    kind: 'notice',
    compile: (action, {catalog}) => {
      requireMacroTarget(
        catalog.notices.sets.find(item => item.id === action.notice),
        'notice',
        action.notice,
      );
      return command({type: 'notice.start', noticeId: action.notice});
    },
  }),
  defineMacroAction({
    kind: 'audio',
    compile: (action, {catalog}) => {
      if (action.operation === 'play') {
        requireMacroTarget(
          catalog.media.items.find(
            item => item.id === action.media && item.kind === 'audio',
          ),
          'audio',
          action.media,
        );
        return command({
          type: 'audio.play',
          source: {kind: 'media', mediaId: action.media},
        });
      }
      return action.operation === 'fadeOut'
        ? command({type: 'audio.fadeOut'})
        : command({type: 'layer.clear', target: 'audio'});
    },
  }),
  defineMacroAction({
    kind: 'audioPlaylist',
    compile: (action, {catalog}) => {
      const playlist = requireMacroTarget(
        catalog.media.audioPlaylists.find(item => item.id === action.playlist),
        'audio-playlist',
        action.playlist,
      );
      const first = playlist.items[0];
      if (first === undefined) throw new Error('Audio playlist is empty');
      requireMacroTarget(
        catalog.media.items.find(
          item => item.id === first && item.kind === 'audio',
        ),
        'audio',
        first,
      );
      return command({
        type: 'audio.play',
        source: {kind: 'playlist', playlistId: action.playlist, position: 0},
      });
    },
  }),
  defineMacroAction({
    kind: 'timer',
    compile: (action, {catalog}) => {
      requireMacroTarget(
        catalog.timers.timers.find(item => item.id === action.timer),
        'timer',
        action.timer,
      );
      return command({
        type: `timer.${action.operation}`,
        timerId: action.timer,
      });
    },
  }),
  defineMacroAction({
    kind: 'macro',
    compile: action => ({kind: 'macro', macroId: action.macro}),
  }),
];

export const macroActions = new MacroActionRegistry(macroActionHandlers);
