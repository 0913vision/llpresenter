import type {LlpApi} from '@contracts/ipc/api';
import type {Screen} from '@core/schema/screens';
import type {PictureCorrection, RenderScreen} from './layer';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {followSettingsDocument} from './settingsFeed';

function pictureCorrection(screen: Screen): PictureCorrection | undefined {
  const edgeMargin = screen.edgeMargin ?? 0;
  const offset = screen.offset ?? {x: 0, y: 0};
  if (edgeMargin === 0 && offset.x === 0 && offset.y === 0) return undefined;
  return {edgeMargin, offset};
}

/** Finds the saved screen with this id, as the main output backend does. */
export function resolveRenderScreen(
  id: string,
  screens: readonly Screen[],
): RenderScreen | undefined {
  const screen = screens.find(candidate => candidate.id === id);
  if (screen === undefined) return undefined;
  const correction = pictureCorrection(screen);
  return {
    id: screen.id,
    name: screen.name,
    kind: screen.kind,
    ...(screen.messageStyleId === undefined
      ? {}
      : {messageStyleId: screen.messageStyleId}),
    method: screen.method,
    ...(screen.songCaption === undefined
      ? {}
      : {songCaption: screen.songCaption}),
    emptyColor: emptyScreenColor(screen),
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
