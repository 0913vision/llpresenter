import type {SingleLiveCommand} from '@shared/commands';
import type {Logger} from '../log';
import {dispatchBatched, type LiveStore} from '../live/store';
import type {SettingsReader} from '../store/settingsStore';
import {switchableScreens} from './savedScreens';

interface LaunchOutputOptions {
  readonly store: LiveStore;
  readonly settings: Promise<SettingsReader | null>;
  readonly log: Logger;
}

/** 켤 때 화면 출력: every screen output on when the preference is on, else nothing. */
export function launchOutputCommands(
  settings: Pick<SettingsReader, 'get' | 'preferences'>,
): readonly SingleLiveCommand[] {
  if (!settings.preferences().showOnLaunch) return [];
  return switchableScreens(settings).map(({id}) => ({
    type: 'output.set',
    screenId: id,
    on: true,
  }));
}

/**
 * Applies 켤 때 화면 출력 once the settings are read, on a normal launch and
 * after 새로 시작 (docs/spec/03-output.md, 08). Never throws.
 */
export async function showOutputsOnLaunch({
  store,
  settings,
  log,
}: LaunchOutputOptions): Promise<void> {
  try {
    const reader = await settings;
    if (reader === null) return;
    dispatchBatched(store, launchOutputCommands(reader), log);
  } catch (error: unknown) {
    log.error('could not turn the outputs on at launch', error);
  }
}
