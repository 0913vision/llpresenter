import {useEffect, useMemo, useState, type JSX} from 'react';
import type {Screen} from '@core/schema/screens';
import {sendLive} from '@renderer/session/live';
import {ScreenPreview} from '@renderer/features/presentation/ScreenPreview';
import {SegmentedControl} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {
  previewCaption,
  signalText,
  type PreviewCaption,
} from './previewCaption';
import {
  useScreenView,
  useScreensSelection,
  type ScreensSelection,
} from './selection';
import {useMonitors} from './useMonitors';
import {useSettingsDocument} from '../../platform/useSettingsDocument';
import styles from './OutputPreview.module.css';
import {fitAspect} from './fitAspect';
import {useElementSize} from './useElementSize';
import {REFERENCE_SCREEN} from '@core/looks/lyricStyle';

type PreviewMode = 'content' | 'pattern';

const LOAD_TITLE = '화면';
const MODE_LABEL = '미리보기 종류';
const MODE_OPTIONS = [
  {value: 'content', label: '화면 내용'},
  {value: 'pattern', label: '테스트 패턴'},
] as const;
const noScreens: readonly Screen[] = [];

function useTestPatternOnOutput(
  screenId: Screen['id'],
  mode: PreviewMode,
): void {
  useEffect(() => {
    if (mode !== 'pattern') return undefined;
    const hide = (): void =>
      sendLive({type: 'screen.testPattern.set', screenId, on: false});
    sendLive({type: 'screen.testPattern.set', screenId, on: true});
    // NOTE(0913vision): The pattern sits above every layer of the real output
    // and a clear doesn't remove it, so it must come off even when the window
    // goes away without React unmounting the panel.
    window.addEventListener('pagehide', hide);
    return () => {
      window.removeEventListener('pagehide', hide);
      hide();
    };
  }, [screenId, mode]);
}

function PreviewBody({
  screen,
  caption,
  selection,
}: {
  readonly screen: Screen;
  readonly caption: PreviewCaption;
  readonly selection: ScreensSelection;
}): JSX.Element {
  const selectionKey =
    selection.kind === 'screen'
      ? `screen:${screen.id}`
      : `${selection.kind}:${selection.id}`;
  const [preview, setPreview] = useState<{
    selectionKey: string;
    mode: PreviewMode;
  }>({selectionKey, mode: 'content'});
  const mode =
    selection.kind === 'screen' || preview.selectionKey === selectionKey
      ? preview.mode
      : 'content';
  if (preview.selectionKey !== selectionKey) {
    setPreview({selectionKey, mode});
  }
  const [watchPicture, available] = useElementSize();
  const picture =
    available === undefined
      ? undefined
      : fitAspect(available, REFERENCE_SCREEN.width / REFERENCE_SCREEN.height);
  useTestPatternOnOutput(screen.id, mode);
  const signal = signalText(caption);
  return (
    <section className={styles.preview} aria-label="출력 미리보기">
      <SegmentedControl
        label={MODE_LABEL}
        options={MODE_OPTIONS}
        value={mode}
        onChange={mode => setPreview({selectionKey, mode})}
        fill
        className={styles.mode}
      />
      <div className={styles.picture} ref={watchPicture}>
        <div className={styles.frame} style={picture} data-preview-picture>
          <ScreenPreview
            screenId={screen.id}
            chroma={screen.method === 'capture'}
          />
        </div>
      </div>
      <div className={styles.caption}>
        <span className={styles.name}>{caption.name}</span>
        <span>{caption.target}</span>
        {signal !== '' && <span>{signal}</span>}
      </div>
    </section>
  );
}

/**
 * The output preview of the selected screen. The picture is always the
 * screen's own preview. 테스트 패턴 puts the screen into the live state's
 * pattern list, so the preview draws the pattern with the screen's correction
 * and its name only, and the real output shows it too. The pattern comes off
 * when the operator picks 화면 내용, selects another screen (the preview starts
 * in 화면 내용 for it), leaves 화면 설정 for any reason, or the window goes
 * away.
 */
export function OutputPreview({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const document = useSettingsDocument('screens', LOAD_TITLE, onProblem);
  const monitors = useMonitors();
  const selection = useScreensSelection(view => view.selection);
  const selected = useScreenView(document?.value.screens ?? noScreens);
  const caption = useMemo(
    () =>
      selected === undefined ? undefined : previewCaption(selected, monitors),
    [selected, monitors],
  );
  if (selected === undefined || caption === undefined) return null;
  return (
    <PreviewBody
      key={selected.id}
      screen={selected}
      caption={caption}
      selection={selection}
    />
  );
}
