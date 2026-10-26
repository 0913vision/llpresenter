import type {LiveState} from '@shared/live';
import type {LookId} from '@shared/schema/ids';
import type {LooksFile} from '@shared/schema/looks';
import type {Screen} from '@shared/schema/screens';
import type {StageLayout} from '@shared/schema/stageLayouts';
import type {RenderFrame} from '@renderer/render/layer';
import {resolveRenderScreen} from '@renderer/render/screenIdentity';
import {resolveScreenLook} from '@renderer/render/screenLook';

export interface LookPreviewInput {
  readonly screen: Screen;
  readonly lookId: LookId;
  readonly looks: LooksFile;
  readonly stageLayouts: readonly StageLayout[];
  readonly state: LiveState | null;
}

/** Resolves the selected Look, independent of the live Look, test pattern and stage override. */
export function lookPreviewFrame({
  screen,
  lookId,
  looks,
  stageLayouts,
  state,
}: LookPreviewInput): RenderFrame {
  const identity = resolveRenderScreen(screen.id, [screen]);
  const {appearance} = resolveScreenLook(looks, lookId, screen);
  const layout =
    screen.kind === 'stage'
      ? stageLayouts.find(layout => layout.id === appearance?.stageLayout)
      : undefined;
  return {
    ...(identity === undefined ? {} : {screen: identity}),
    ...(appearance === null ? {} : {look: appearance}),
    ...(layout === undefined
      ? {}
      : {
          stage: {
            layout,
            ...(state?.stageTimerId === undefined
              ? {}
              : {timerId: state.stageTimerId}),
          },
        }),
    stageMessage: state?.stageMessage ?? null,
  };
}
