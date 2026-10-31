import type {JSX} from 'react';
import {useLive, useOutputs} from '@renderer/session/live';
import {
  useHasMediaView,
  useMediaView,
} from '@renderer/features/media/MediaViewProvider';
import {showLarge, usePreview} from '@renderer/session/preview';
import {useScreenSummaries} from '@renderer/platform/ScreenSummaries';
import {PreviewFrame, type PreviewScreen} from '@renderer/ui/PreviewFrame';
import {ScreenPreview} from './ScreenPreview';
import styles from './PreviewPanel.module.css';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {resolveOutputScreen} from '@core/screens/screens';
import {resolveScreenLook, showsLayer} from '@core/looks/screenLook';
import {MISSING_STILL_BACKGROUND_TIP} from '@renderer/platform/problemReasons';
import {LiveMediaProgress} from './LiveMediaProgress';

const NO_STILL_SCREENS: ReadonlySet<string> = new Set();

function renderScreen(screen: PreviewScreen<string>): JSX.Element {
  return <ScreenPreview screenId={screen.id} chroma={screen.chroma === true} />;
}

function MediaPreviewPanel({
  compact,
}: {
  readonly compact: boolean;
}): JSX.Element {
  const {view} = useMediaView();
  const mediaId = useLive(state => state.state?.layers.media?.mediaId);
  const lookId = useLive(state => state.state?.lookId);
  const testPatterns = useLive(state => state.state?.testPatterns);
  const screens = useSettingsDocument('screens', '화면', undefined);
  const looks = useSettingsDocument('looks', 'Look', undefined);
  const summaries = useScreenSummaries();
  const media = view.document?.value.items.find(item => item.id === mediaId);
  const missingStill = media?.kind === 'video' && view.missing.has(media.id);
  const stillScreens = new Set<string>();
  if (missingStill) {
    for (const summary of summaries) {
      const screen = resolveOutputScreen(
        summary.id,
        screens?.value.screens ?? [],
      );
      if (!screen || testPatterns?.includes(screen.id)) continue;
      const {appearance} = resolveScreenLook(
        looks?.value ?? null,
        lookId,
        screen,
      );
      if (showsLayer(appearance, 'media')) stillScreens.add(summary.id);
    }
  }
  return <PreviewPanelFrame compact={compact} stillScreens={stillScreens} />;
}

/** Uses the workspace's shared media metadata without opening another feed. */
export function PreviewPanel({
  compact,
}: {
  readonly compact: boolean;
}): JSX.Element {
  return useHasMediaView() ? (
    <MediaPreviewPanel compact={compact} />
  ) : (
    <PreviewPanelFrame compact={compact} />
  );
}

/** The live monitoring panel. Selecting a screen never sends an output command. */
function PreviewPanelFrame({
  compact,
  stillScreens = NO_STILL_SCREENS,
}: {
  readonly compact: boolean;
  readonly stillScreens?: ReadonlySet<string>;
}): JSX.Element {
  const largeScreenId = usePreview(view => view.largeScreenId);
  const outputs = useOutputs();
  const summaries = useScreenSummaries();
  const large = summaries.some(screen => screen.id === largeScreenId)
    ? largeScreenId
    : (summaries[0]?.id ?? '');
  const screens: ReadonlyArray<PreviewScreen<string>> = summaries.map(
    screen => ({
      id: screen.id,
      name: screen.statusLabel,
      target: {
        kind: screen.targetKind,
        label: screen.target,
      },
      status: {kind: outputs[screen.id] === true ? 'on' : 'off'},
      chroma: screen.chroma,
      indicator: stillScreens.has(screen.id)
        ? {icon: 'pause', text: MISSING_STILL_BACKGROUND_TIP}
        : undefined,
    }),
  );
  return (
    <div className={styles.panel}>
      <div className={styles.screens}>
        <PreviewFrame
          screens={screens}
          big={large}
          compact={compact}
          sizing="content"
          onBigChange={showLarge}
          renderScreen={renderScreen}
        />
      </div>
      <LiveMediaProgress />
    </div>
  );
}
