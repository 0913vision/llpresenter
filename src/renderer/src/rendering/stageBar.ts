import {STAGE_BAR_GROUP_TOP_WITH_MESSAGE} from '@core/themes/starterLayout';
import {STAGE_COLORS} from '@core/themes/stageColors';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {ThemeScreenLayout} from '@core/schema/themes';

/** Make room for a stage message without moving custom stage layouts. */
export function stageBarLayout(
  layout: ThemeScreenLayout,
  {
    stage,
    message,
    item,
  }: {
    stage: boolean;
    message: string | null | undefined;
    item?: LiveThemeItem | null;
  },
): ThemeScreenLayout {
  if (
    !stage ||
    (!message && item?.kind !== 'bible') ||
    layout.mode.kind !== 'own' ||
    layout.stageBar !== 'message-row'
  ) {
    return layout;
  }
  return {
    ...layout,
    elements: layout.elements.map(element => {
      const group =
        (element.kind === 'text' &&
          (element.stageSource === 'stageItemName' ||
            element.stageSource === 'stagePosition')) ||
        (element.kind === 'label' && element.hideWhenItemTitle === true);
      if (
        element.kind === 'label' &&
        element.hideWhenItemTitle &&
        item?.kind === 'bible'
      ) {
        return {
          ...element,
          frame: {
            x: 154,
            y: message ? STAGE_BAR_GROUP_TOP_WITH_MESSAGE : 26,
            w: 1612,
            h: 58,
          },
          text: {
            ...element.text,
            size: 48,
            color: STAGE_COLORS.clock,
            align: 'center',
          },
        };
      }
      return group && message
        ? {
            ...element,
            frame: {...element.frame, y: STAGE_BAR_GROUP_TOP_WITH_MESSAGE},
          }
        : element;
    }),
  };
}
