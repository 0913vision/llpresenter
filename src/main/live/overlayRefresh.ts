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
  const active = state.layers.notice;
  if (document.name !== 'notices' || active === null) return [];
  const notice = document.value.sets.find(item => item.id === active.noticeId);
  if (notice === undefined || notice.media.length === 0) {
    return [{type: 'notice.stop'}];
  }
  const start: SingleLiveCommand = {type: 'notice.start', noticeId: notice.id};
  return active.playback?.pausedAt == null
    ? [start]
    : [start, {type: 'notice.pause'}];
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
