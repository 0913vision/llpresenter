import {
  parseActiveProps,
  type ActiveProp,
} from '@core/schema/live/overlayState';
import {MissingLiveTargetError} from '../commandErrors';
import {setLayer, updateLayer, type LiveHistory} from '../history';
import {propLayer} from '../overlays/propLayer';
import {defineSlice, type CommandOf, type SliceContext} from '../slice';

/** Puts a 그래픽 on the screens or takes it off. */
function setProp(
  history: LiveHistory,
  command: CommandOf<'prop.set'>,
  {settings, audioMedia, isMissingMedia, reject}: SliceContext,
): LiveHistory {
  const previous = history.state.layers.prop?.items ?? [];
  const retained = previous.filter(item => item.propId !== command.propId);
  if (!command.on) {
    if (retained.length === previous.length) return history;
    return updateLayer(history, 'prop', propLayer(retained));
  }
  const document = settings?.get('props');
  if (document?.name !== 'props') {
    throw new Error('Prop settings are unavailable');
  }
  const prop = document.value.props.find(item => item.id === command.propId);
  if (prop === undefined) {
    throw new MissingLiveTargetError({kind: 'prop', id: command.propId});
  }
  const current = previous.find(item => item.propId === prop.id);
  const library = audioMedia?.();
  const content = prop.content;
  // NOTE(0913vision): An image that left the list or whose file is missing
  // can't be shown (spec 08); one already on screen can still go.
  if (
    current === undefined &&
    content.kind === 'image' &&
    ((library !== undefined &&
      !library.items.some(item => item.id === content.media)) ||
      isMissingMedia?.(content.media) === true)
  ) {
    throw new MissingLiveTargetError({kind: 'media', id: content.media});
  }
  const targets = [...new Set(prop.targets)];
  if (
    current?.content === prop.content &&
    current.targets.length === targets.length &&
    current.targets.every((id, index) => id === targets[index])
  ) {
    return history;
  }
  const items: readonly ActiveProp[] = [
    ...retained,
    {propId: prop.id, content: prop.content, targets},
  ];
  const parsed = parseActiveProps(items);
  if (!parsed.ok) return reject(parsed.error);
  return setLayer(history, 'prop', propLayer(items));
}

/**
 * Puts a 그래픽 on and takes it off: `prop.toggle` turns it the other way from
 * where main has it, so quick presses each count.
 */
export const propsSlice = defineSlice({
  commands: ['prop.set', 'prop.toggle'],
  initial: {},
  reduce: (history, command, context) => {
    if (command.type === 'prop.set') return setProp(history, command, context);
    const on = (history.state.layers.prop?.items ?? []).some(
      item => item.propId === command.propId,
    );
    return context.apply(history, {
      type: 'prop.set',
      propId: command.propId,
      on: !on,
    });
  },
});
