import type {LlpApi} from '@contracts/ipc/api';
import type {RenderScreen} from './layer';
import {resolveRenderScreen} from '@core/screens/renderScreen';
export {resolveRenderScreen} from '@core/screens/renderScreen';
import {followSettingsDocument} from './settingsFeed';

/** Follows routing identity without letting an old read override a newer edit. */
export function followRenderScreen(options: {
  readonly settings: LlpApi['settings'];
  readonly id: string;
  readonly receive: (screen: RenderScreen | undefined) => void;
  readonly onError: (message: string, error: unknown) => void;
}): () => void {
  return followSettingsDocument({
    settings: options.settings,
    name: 'screens',
    select: document =>
      document.name === 'screens' ? document.value.screens : undefined,
    receive: screens =>
      options.receive(resolveRenderScreen(options.id, screens)),
    onError: error =>
      options.onError('could not read output screen identity', error),
  });
}
