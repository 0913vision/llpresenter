import {useMemo, useSyncExternalStore} from 'react';
import type {ThemePlacement} from '@core/theme/layout';
import {placeTexts} from '@renderer/rendering/theme/placement';
import type {ThemeDrawing} from '@renderer/rendering/theme/themeView';

let fontsRevision = 0;

function subscribe(listener: () => void): () => void {
  const loaded = (): void => {
    fontsRevision++;
    listener();
  };
  document.fonts.addEventListener('loadingdone', loaded);
  return () => document.fonts.removeEventListener('loadingdone', loaded);
}

const NOTHING: ThemePlacement = {texts: new Map(), shapes: new Map()};

/** Where a drawing has its texts; a font that arrived since changes them. */
function placementWith(
  drawing: ThemeDrawing | null,
  fonts: number,
): ThemePlacement {
  return drawing === null || fonts < 0
    ? NOTHING
    : placeTexts(drawing).placement;
}

/** Where the texts and shapes of a drawing are, as the output places them. */
export function useThemePlacement(
  drawing: ThemeDrawing | null,
): ThemePlacement {
  const fonts = useSyncExternalStore(subscribe, () => fontsRevision);
  return useMemo(() => placementWith(drawing, fonts), [drawing, fonts]);
}
