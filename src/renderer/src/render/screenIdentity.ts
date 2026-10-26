import type {LlpApi} from '@shared/ipc';
import type {Screen} from '@shared/schema/screens';
import type {PictureCorrection, RenderScreen} from './layer';
import {resolveOutputScreen} from '@shared/screens';
import {followSettingsDocument} from './settingsFeed';

function pictureCorrection(screen: Screen): PictureCorrection | undefined {
  const edgeMargin = screen.edgeMargin ?? 0;
  const offset = screen.offset ?? {x: 0, y: 0};
  if (edgeMargin === 0 && offset.x === 0 && offset.y === 0) return undefined;
  return {edgeMargin, offset};
}

/** Uses the same configured and starter identities as the main output backend. */
export function resolveRenderScreen(
  id: string,
  screens: readonly Screen[],
): RenderScreen | undefined {
  const screen = resolveOutputScreen(id, screens);
  if (screen === undefined) return undefined;
  const correction = pictureCorrection(screen);
  return {
    id: screen.id,
    name: screen.name,
    kind: screen.kind,
    method: screen.method,
    ...(correction === undefined ? {} : {correction}),
  };
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
