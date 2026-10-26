import {parseActiveProps} from '@shared/schema/overlayState';
import type {ActiveProp} from '@shared/live';
import {MissingLiveTargetError} from '../commandErrors';
import {setLayer, updateLayer} from '../history';
import {propLayer} from '../propState';
import {defineSlice} from '../slice';

export const propsSlice = defineSlice({
  commands: ['prop.set'],
  initial: {},
  reduce: (history, command, {settings, reject}) => {
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
  },
});
