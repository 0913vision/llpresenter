import {LIVE_STATE_LIMITS} from '@shared/schema/liveLimits';
import type {Screen} from '@shared/schema/screens';
import type {SettingsReader} from '../store/settingsStore';

/** The screens of `screens.json`, or none while it can't be read. */
export function savedScreens(
  settings: Pick<SettingsReader, 'get'>,
): readonly Screen[] {
  const document = settings.get('screens');
  return document.name === 'screens' ? document.value.screens : [];
}

/** The saved screens whose output can turn on: every method but NDI, within the live output cap. */
export function switchableScreens(
  settings: Pick<SettingsReader, 'get'>,
): readonly Screen[] {
  return savedScreens(settings)
    .filter(({method}) => method !== 'ndi')
    .slice(0, LIVE_STATE_LIMITS.outputs);
}
