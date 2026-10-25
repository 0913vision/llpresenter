import type {ActiveMessage, MessageLayer} from '@shared/live';
import {parseActiveMessages} from '@shared/schema/overlayState';
import type {ScreenId} from '@shared/schema/ids';
import {MissingLiveTargetError} from '../commandErrors';
import {setLayer, withLayers, type LiveHistory} from '../history';
import {messageLayer} from '../messageState';
import {defineSlice, type CommandOf, type SliceContext} from '../slice';

function targetsFor(
  command: CommandOf<'message.send'>,
  context: SliceContext,
): {
  readonly targets: readonly ScreenId[];
  readonly screens: readonly ScreenId[];
} {
  const document = context.settings?.get('screens');
  if (document?.name !== 'screens') {
    throw new Error('Screen settings are unavailable');
  }
  const screens = document.value.screens.map(screen => screen.id);
  if (command.targets === 'all') return {targets: screens, screens};
  for (const id of command.targets) {
    if (!screens.includes(id)) {
      throw new MissingLiveTargetError({kind: 'screen', id});
    }
  }
  return {targets: command.targets, screens};
}

function send(
  history: LiveHistory,
  command: CommandOf<'message.send'>,
  context: SliceContext,
): LiveHistory {
  const {targets, screens} = targetsFor(command, context);
  if (targets.length === 0) return history;
  if (context.nextMessageId === undefined) {
    throw new Error('Message id provider is unavailable');
  }
  const layer = history.state.layers.message;
  const previous: readonly ActiveMessage[] =
    layer?.items ??
    (layer === null
      ? []
      : [
          {
            messageId: context.nextMessageId(),
            text: layer.text,
            targets: screens,
            excludedTargets: [],
            startedAt: context.now,
            expiresAt: null,
          },
        ]);
  const retained = previous.flatMap(item => {
    const available = item.targets === 'all' ? screens : item.targets;
    const remaining = available.filter(
      id => !targets.includes(id) && !item.excludedTargets.includes(id),
    );
    return remaining.length === 0
      ? []
      : [{...item, targets: remaining, excludedTargets: []}];
  });
  const message: ActiveMessage = {
    messageId: context.nextMessageId(),
    text: command.text,
    targets,
    excludedTargets: [],
    startedAt: context.now,
    expiresAt:
      command.duration === null ? null : context.now + command.duration * 1000,
  };
  const parsed = parseActiveMessages([...retained, message]);
  if (!parsed.ok) return context.reject(parsed.error);
  return setLayer(history, 'message', messageLayer(parsed.value));
}

function withoutExpired(
  layer: MessageLayer | null,
  command: CommandOf<'message.expire'>,
): MessageLayer | null {
  if (layer?.items === undefined) return layer;
  const items = layer.items.filter(
    item =>
      item.messageId !== command.messageId ||
      item.expiresAt !== command.expiresAt,
  );
  return items.length === layer.items.length ? layer : messageLayer(items);
}

function expire(
  history: LiveHistory,
  command: CommandOf<'message.expire'>,
  now: number,
): LiveHistory {
  if (now < command.expiresAt) return history;
  const message = withoutExpired(history.state.layers.message, command);
  if (message === history.state.layers.message) return history;
  const undo =
    history.undo === null
      ? null
      : {
          ...history.undo,
          layers: {
            ...history.undo.layers,
            message: withoutExpired(history.undo.layers.message, command),
          },
        };
  return withLayers(history, {...history.state.layers, message}, undo);
}

export const messagesSlice = defineSlice({
  commands: ['message.send', 'message.expire'],
  initial: {},
  reduce: (history, command, context) =>
    command.type === 'message.send'
      ? send(history, command, context)
      : expire(history, command, context.now),
});
