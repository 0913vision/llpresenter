import type {JSX} from 'react';
import {parseScreenId} from '@core/schema/common/ids';
import type {Screen} from '@core/schema/screens/screens';
import {KIND_NAMES} from '@core/screens';
import {themeScreenOf} from '@core/theme';
import {useLive, useOutputs} from '@renderer/session/live';
import {
  useHasMediaView,
  useMediaView,
} from '@renderer/features/media/MediaViewProvider';
import {
  setPreviewVisible,
  showLarge,
  usePreview,
} from '@renderer/session/preview';
import {useScreenSummaries} from '@renderer/platform/ScreenSummaries';
import type {PreviewScreen} from '@renderer/ui/previews/PreviewFrame';
import {PreviewPanel as SharedPreviewPanel} from '@renderer/ui/previews/PreviewPanel';
import {OutputMirror} from './OutputMirror';
import {ScreenPreview} from './ScreenPreview';
import {KeptFramesContext, useKeptScreenFrames} from './keptScreenFrames';
import {useSlideTransitionProgress} from './useSlideTransitionProgress';
import {MISSING_STILL_BACKGROUND_TIP} from '@renderer/platform/problemReasons';
import {LiveMediaProgress} from './LiveMediaProgress';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';

/** 청중, 무대, or 방송, while one screen has the kind. */
function shortNameOf(
  kind: Screen['kind'],
  summaries: ReturnType<typeof useScreenSummaries>,
): string | undefined {
  const same = summaries.filter(screen => (screen.kind ?? 'audience') === kind);
  return same.length === 1 ? KIND_NAMES[kind] : undefined;
}

const NO_STILL_SCREENS: ReadonlySet<string> = new Set();

function reportFramesError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : '';
  window.llp?.log.write({level: 'error', message, detail});
}

function renderScreen(screen: PreviewScreen<string>): JSX.Element {
  return screen.status.kind === 'on' ? (
    <OutputMirror screenId={screen.id} targetKind={screen.target?.kind} />
  ) : (
    <ScreenPreview screenId={screen.id} chroma={screen.chroma === true} />
  );
}

function MediaPreviewPanel(): JSX.Element {
  const {view} = useMediaView();
  const mediaId = useLive(state => state.state?.layers.media?.mediaId);
  const testPatterns = useLive(state => state.state?.testPatterns);
  const summaries = useScreenSummaries();
  const output = useLive(state => state.state?.themeOutput);
  const media = view.document?.value.items.find(item => item.id === mediaId);
  const missingStill = media?.kind === 'video' && view.missing.has(media.id);
  const stillScreens = new Set<string>();
  if (missingStill && output !== undefined) {
    for (const summary of summaries) {
      const id = parseScreenId(summary.id);
      if (!id.ok || testPatterns?.includes(id.value) === true) continue;
      const screen = themeScreenOf(output.theme, {
        id: id.value,
        kind: summary.kind ?? 'audience',
      });
      if (screen?.elements.some(element => element.kind === 'background')) {
        stillScreens.add(summary.id);
      }
    }
  }
  return <PreviewPanelFrame stillScreens={stillScreens} />;
}

/** Uses the workspace's shared media metadata without opening another feed. */
export function PreviewPanel(): JSX.Element {
  return useHasMediaView() ? <MediaPreviewPanel /> : <PreviewPanelFrame />;
}

/** The live monitoring panel. Selecting a screen never sends an output command. */
function PreviewPanelFrame({
  stillScreens = NO_STILL_SCREENS,
}: {
  readonly stillScreens?: ReadonlySet<string>;
}): JSX.Element {
  const largeScreenId = usePreview(view => view.largeScreenId);
  const visible = usePreview(view => view.visible);
  const transitionProgress = useSlideTransitionProgress();
  const outputs = useOutputs();
  const summaries = useScreenSummaries();
  const kept = useKeptScreenFrames(
    summaries.map(screen => screen.id),
    reportFramesError,
  );
  useWindowShortcuts(
    summaries.map(screen => ({
      id: `preview.focus.${screen.id}`,
      run: () => {
        showLarge(screen.id);
      },
    })),
  );
  const large = summaries.some(screen => screen.id === largeScreenId)
    ? largeScreenId
    : (summaries[0]?.id ?? '');
  const screens: ReadonlyArray<PreviewScreen<string>> = summaries.map(
    screen => ({
      id: screen.id,
      name: screen.statusLabel,
      shortName: shortNameOf(screen.kind ?? 'audience', summaries),
      target: {
        kind: screen.targetKind,
        label: screen.target,
      },
      status: {kind: outputs[screen.id] === true ? 'on' : 'off'},
      chroma: screen.chroma,
      transitionProgress:
        (screen.kind ?? 'audience') === 'audience'
          ? transitionProgress
          : undefined,
      indicator: stillScreens.has(screen.id)
        ? {icon: 'pause', text: MISSING_STILL_BACKGROUND_TIP}
        : undefined,
    }),
  );
  return (
    <KeptFramesContext value={kept}>
      <SharedPreviewPanel
        screens={screens}
        visible={visible}
        onVisibleChange={setPreviewVisible}
        big={large}
        overlay={<LiveMediaProgress />}
        onBigChange={id => {
          showLarge(id);
        }}
        renderScreen={renderScreen}
      />
    </KeptFramesContext>
  );
}
