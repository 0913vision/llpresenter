import type {SingleLiveCommand} from '@shared/commands';
import type {LiveState} from '@shared/live';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';

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

/** Ends the 무대 화면's 타이머 choice once that 타이머 is deleted. */
export function stageRefreshCommands(
  {stageTimerId}: LiveState,
  document: SettingsDocument,
): readonly SingleLiveCommand[] {
  if (document.name !== 'timers' || stageTimerId === undefined) return [];
  return document.value.timers.some(({id}) => id === stageTimerId)
    ? []
    : [{type: 'stage.timer.set', timerId: null}];
}
