import {useMemo, type JSX} from 'react';
import type {Screen} from '@core/schema/screens';
import {showTestPattern} from './showTestPattern';
import {ScreenPreview} from '@renderer/features/presentation/ScreenPreview';
import {OutputMirror} from '@renderer/features/presentation/OutputMirror';
import {useLive} from '@renderer/session/live';
import {Button} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {
  previewCaption,
  signalText,
  type PreviewCaption,
} from './previewCaption';
import {useScreenView} from './selection';
import {useMonitors} from './useMonitors';
import {useSettingsDocument} from '../../platform/useSettingsDocument';
import styles from './OutputPreview.module.css';
import {fitAspect} from '@core/canvas/fitAspect';
import {useElementSize} from '@renderer/ui/useElementSize';
import {REFERENCE_SCREEN} from '@core/themes/textStyle';
import {pictureSizeForScreen} from '@core/screens/pictureSize';

const LOAD_TITLE = '화면';
const noScreens: readonly Screen[] = [];

function PreviewBody({
  screen,
  caption,
  pictureEnabled,
}: {
  readonly screen: Screen;
  readonly caption: PreviewCaption;
  readonly pictureEnabled: boolean;
}): JSX.Element {
  const [watchPicture, available] = useElementSize();
  const outputActive = useLive(view => view.state?.outputs[screen.id] === true);
  const outputSize = pictureSizeForScreen(screen) ?? REFERENCE_SCREEN;
  const picture =
    available === undefined
      ? undefined
      : fitAspect(available, outputSize.width / outputSize.height);
  const signal = signalText(caption);
  return (
    <section className={styles.preview} aria-label="출력 미리보기">
      <Button onClick={() => showTestPattern(screen.id)}>테스트 화면</Button>
      <div className={styles.picture} ref={watchPicture}>
        <div className={styles.frame} style={picture} data-preview-picture>
          {pictureEnabled ? (
            outputActive ? (
              <OutputMirror screenId={screen.id} />
            ) : (
              <ScreenPreview
                screenId={screen.id}
                chroma={screen.method === 'capture'}
              />
            )
          ) : null}
        </div>
      </div>
      <div className={styles.caption}>
        <span>{caption.target}</span>
        {signal !== '' && <span>{signal}</span>}
      </div>
    </section>
  );
}

/** The output preview and a test pattern command for the selected screen. */
export function OutputPreview({
  onProblem,
  pictureEnabled = true,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly pictureEnabled?: boolean | undefined;
}): JSX.Element | null {
  const document = useSettingsDocument('screens', LOAD_TITLE, onProblem);
  const monitors = useMonitors();
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
      pictureEnabled={pictureEnabled}
    />
  );
}
