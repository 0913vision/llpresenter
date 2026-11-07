import {useLayoutEffect, useRef, type JSX} from 'react';
import {useLive, useOutputs} from '@renderer/session/live';
import {
  useHasMediaView,
  useMediaView,
} from '@renderer/features/media/MediaViewProvider';
import {setTilesHidden, showLarge, usePreview} from '@renderer/session/preview';
import {useScreenSummaries} from '@renderer/platform/ScreenSummaries';
import {PreviewFrame, type PreviewScreen} from '@renderer/ui/PreviewFrame';
import {PreviewScreenPicker} from '@renderer/ui/PreviewScreenPicker';
import {usePreviewRoom} from '@renderer/ui/usePreviewRoom';
import {ScreenPreview} from './ScreenPreview';
import styles from './PreviewPanel.module.css';
import {MISSING_STILL_BACKGROUND_TIP} from '@renderer/platform/problemReasons';
import {LiveMediaProgress} from './LiveMediaProgress';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';

const NO_STILL_SCREENS: ReadonlySet<string> = new Set();

/** The progress bar lies over the picture, so no row is reserved for it. */
function noExtraRows(): number {
  return 0;
}

/** The screen picker of the panel header, shown while the tile row is hidden. */
export function PreviewHeaderPicker(): JSX.Element | null {
  const hidden = usePreview(view => view.tilesHidden);
  const largeScreenId = usePreview(view => view.largeScreenId);
  const summaries = useScreenSummaries();
  if (!hidden || summaries.length < 2) return null;
  const big = summaries.some(screen => screen.id === largeScreenId)
    ? largeScreenId
    : (summaries[0]?.id ?? '');
  return (
    <PreviewScreenPicker
      screens={summaries.map(screen => ({
        id: screen.id,
        name: screen.statusLabel,
      }))}
      big={big}
      onChange={showLarge}
    />
  );
}

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
  const testPatterns = useLive(state => state.state?.testPatterns);
  const summaries = useScreenSummaries();
  const output = useLive(state => state.state?.themeOutput);
  const itemKind = useLive(state => state.state?.themeItem?.kind);
  const media = view.document?.value.items.find(item => item.id === mediaId);
  const missingStill = media?.kind === 'video' && view.missing.has(media.id);
  const stillScreens = new Set<string>();
  if (missingStill) {
    const kind = itemKind === 'media' ? 'media' : 'background';
    const compositions = Object.entries(output?.screens ?? {}).map(
      ([id, composition]) => ({id, composition}),
    );
    for (const summary of summaries) {
      const match = compositions.find(screen => screen.id === summary.id);
      if (match === undefined || testPatterns?.some(id => id === match.id)) {
        continue;
      }
      if (
        match.composition.layout.elements.some(element => element.kind === kind)
      ) {
        stillScreens.add(summary.id);
      }
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
  useWindowShortcuts(
    summaries.map(screen => ({
      id: `preview.focus.${screen.id}`,
      run: () => showLarge(screen.id),
    })),
  );
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
  const root = useRef<HTMLDivElement>(null);
  const room = usePreviewRoom(root, {
    tiles: Math.max(0, summaries.length - 1),
    extra: noExtraRows,
  });
  useLayoutEffect(() => {
    setTilesHidden(!room);
    return () => setTilesHidden(false);
  }, [room]);
  return (
    <div ref={root} className={styles.panel}>
      <div className={styles.screens}>
        <PreviewFrame
          screens={screens}
          big={large}
          compact={compact}
          sizing="content"
          tiles={room}
          overlay={<LiveMediaProgress />}
          onBigChange={showLarge}
          renderScreen={renderScreen}
        />
      </div>
    </div>
  );
}
