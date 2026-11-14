import type {Screen} from '../schema/screens';
import {emptyScreenColor} from './emptyColor';

function pictureCorrection(screen: Screen) {
  const edgeMargin = screen.edgeMargin ?? 0;
  const offset = screen.offset ?? {x: 0, y: 0};
  if (edgeMargin === 0 && offset.x === 0 && offset.y === 0) return undefined;
  return {edgeMargin, offset};
}

/** Finds the saved screen with this id, as the main output backend does. */
export function resolveRenderScreen(id: string, screens: readonly Screen[]) {
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
