import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceItem} from '@core/schema/service';
import {useItemTheme} from './ItemThemeRow';
import {useItemMedia} from './useItemSources';
import type {OverlayEditing} from './overlayEditing';

/** Gathers what the 오버레이 clips of one item need: its screens and the media list. */
export function useOverlayEditing({
  api,
  item,
  count,
  reason,
  change,
}: {
  readonly api: Pick<LlpApi, 'settings' | 'media'>;
  readonly item: ServiceItem | null;
  readonly count: number;
  readonly reason: string | undefined;
  readonly change: OverlayEditing['change'];
}): {
  readonly editing: OverlayEditing;
  /** The names of screens that an 오버레이 uses but whose theme has no element for it. */
  readonly missing: readonly string[];
} {
  const {targets, missing} = useItemTheme(api.settings, item);
  const media = useItemMedia(api.media);
  const first = targets[0];
  return {
    editing: {
      overlays: item?.overlays ?? [],
      count,
      reason,
      screens: targets,
      defaultScreens: first === undefined ? [] : [first.id],
      media: media.document?.value.items ?? [],
      change,
    },
    missing,
  };
}
