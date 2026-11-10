import {STAGE_BAR_GROUP_TOP_WITH_MESSAGE} from '@core/themes/starterLayout';
import type {ThemeScreenLayout} from '@core/schema/themes';

/** Make room for a stage message without moving custom stage layouts. */
export function stageBarLayout(
  layout: ThemeScreenLayout,
  stage: boolean,
  message: string | null | undefined,
): ThemeScreenLayout {
  if (
    !stage ||
    !message ||
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
      return group
        ? {
            ...element,
            frame: {...element.frame, y: STAGE_BAR_GROUP_TOP_WITH_MESSAGE},
          }
        : element;
    }),
  };
}
