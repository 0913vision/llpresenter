import type {SingleLiveCommand} from '@core/live/commands';
import type {LiveState} from '@core/live/state';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {createTimerId} from '@core/schema/ids';

/** Updates active overlay snapshots when their saved configuration changes. */
export function overlayRefreshCommands(
  state: LiveState,
  document: SettingsDocument,
): readonly SingleLiveCommand[] {
  if (document.name === 'props') {
    return (state.layers.prop?.items ?? []).map(item => ({
      type: 'prop.set',
      propId: item.propId,
      on: document.value.props.some(prop => prop.id === item.propId),
    }));
  }
  return [];
}

/** Releases runs and the stage choice after their timer definitions are removed. */
export function timerRefreshCommands(
  {stageTimerId, timers: runs}: LiveState,
  document: SettingsDocument,
): readonly SingleLiveCommand[] {
  if (document.name !== 'timers') return [];
  const defined = new Set(document.value.timers.map(timer => timer.id));
  const commands = Object.keys(runs ?? {})
    .map(createTimerId)
    .filter(id => !defined.has(id))
    .map((timerId): SingleLiveCommand => ({type: 'timer.reset', timerId}));
  if (stageTimerId !== undefined && !defined.has(stageTimerId)) {
    commands.push({type: 'stage.timer.set', timerId: null});
  }
  return commands;
}
