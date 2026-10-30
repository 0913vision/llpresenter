import type {JSX} from 'react';
import {useOutputs} from '@renderer/platform/live';
import {showLarge, usePreview} from '@renderer/state/preview';
import {useScreenSummaries} from '@renderer/platform/ScreenSummaries';
import {PreviewFrame, type PreviewScreen} from '@renderer/ui/PreviewFrame';
import {ScreenPreview} from './ScreenPreview';
import styles from './PreviewPanel.module.css';

function renderScreen(screen: PreviewScreen<string>): JSX.Element {
  return <ScreenPreview screenId={screen.id} chroma={screen.chroma === true} />;
}

/** The live monitoring panel. Selecting a screen never sends an output command. */
export function PreviewPanel({
  compact,
}: {
  readonly compact: boolean;
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
    }),
  );
  return (
    <div className={styles.panel}>
      <PreviewFrame
        screens={screens}
        big={large}
        compact={compact}
        sizing="content"
        onBigChange={showLarge}
        renderScreen={renderScreen}
      />
    </div>
  );
}
