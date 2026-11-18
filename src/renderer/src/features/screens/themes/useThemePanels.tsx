import {useEffect} from 'react';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import type {ThemesFile} from '@core/schema/themes';
import {useLive} from '@renderer/session/live';
import {keepThumbnails} from '@renderer/ui/keptThumbnails';
import type {Notice} from '@renderer/ui/notices';
import {useThemeEditor} from './useThemeEditor';
import {useThemeSurfaces} from './ThemeCanvas';
import {ThemeProperties} from './ThemeProperties';
import type {ThemeLeaveGuard} from './themeLeaveGuard';

/** Every picture file the themes place as an image element. */
function themeImages(file: ThemesFile): string[] {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const each of value) walk(each);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const kind: unknown = Reflect.get(value, 'kind');
    const mediaId: unknown = Reflect.get(value, 'mediaId');
    if (kind === 'image' && typeof mediaId === 'string') {
      found.add(mediaUrl(mediaId));
    }
    for (const each of Object.values(value)) walk(each);
  };
  walk(file);
  return [...found];
}

export function useThemePanels(
  active: boolean,
  onProblem: ((notice: Notice) => void) | undefined,
  leaveGuard?: ThemeLeaveGuard,
) {
  const model = useThemeEditor(active, onProblem, leaveGuard);
  // NOTE(0913vision): The themes' pictures load once 테마 opens, so a theme
  // picked for the first time shows its picture in its first frame.
  const file = model.file;
  useEffect(() => {
    if (active && file !== null) keepThumbnails(themeImages(file));
  }, [active, file]);
  const live = useLive(view => view.state);
  const liveId =
    live?.themeOutput?.themeId ??
    (live !== null && live.layers.slide === null && live.layers.media === null
      ? model.file?.standby.id
      : undefined);
  const surfaces = useThemeSurfaces(model, liveId, onProblem);
  return {
    ...surfaces,
    ready:
      ((model.document !== null && model.file !== null) ||
        model.themesFailed ||
        window.llp === undefined) &&
      model.screensReady,
    right: <ThemeProperties model={model} />,
  };
}
