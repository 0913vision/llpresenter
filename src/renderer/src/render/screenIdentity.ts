import type {LlpApi} from '@shared/ipc';
import type {Screen} from '@shared/schema/screens';
import type {RenderScreen} from './layer';
import {resolveOutputScreen} from '@shared/screens';
import {followSettingsDocument} from './settingsFeed';

/** Uses the same configured and starter identities as the main output backend. */
export function resolveRenderScreen(
  id: string,
  screens: readonly Screen[],
): RenderScreen | undefined {
  const screen = resolveOutputScreen(id, screens);
  return screen === undefined
    ? undefined
    : {id: screen.id, kind: screen.kind, method: screen.method};
}

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
