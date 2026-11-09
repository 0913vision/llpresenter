import type {JSX} from 'react';
import {useLive, useOutputs} from '@renderer/session/live';
import {
  useHasMediaView,
  useMediaView,
} from '@renderer/features/media/MediaViewProvider';
import {showLarge, usePreview} from '@renderer/session/preview';
import {useScreenSummaries} from '@renderer/platform/ScreenSummaries';
import type {PreviewScreen} from '@renderer/ui/PreviewFrame';
import {PreviewPanel as SharedPreviewPanel} from '@renderer/ui/PreviewPanel';
import {ScreenPreview} from './ScreenPreview';
import {MISSING_STILL_BACKGROUND_TIP} from '@renderer/platform/problemReasons';
import {LiveMediaProgress} from './LiveMediaProgress';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';

const NO_STILL_SCREENS: ReadonlySet<string> = new Set();

function renderScreen(screen: PreviewScreen<string>): JSX.Element {
  return <ScreenPreview screenId={screen.id} chroma={screen.chroma === true} />;
}

function MediaPreviewPanel(): JSX.Element {
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
  return (
    <SharedPreviewPanel
      screens={screens}
      big={large}
      overlay={<LiveMediaProgress />}
      onBigChange={showLarge}
      renderScreen={renderScreen}
    />
  );
}
