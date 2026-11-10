import {create} from 'zustand';
import type {JSX} from 'react';
import type {UiState} from '@core/schema/uiState';
import type {UiApi} from '@contracts/ipc/ui';
import type {SlideSurfaceMode} from './SlideCardRenderer';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {
  clampThumbnailScale,
  commitThumbnailScale,
} from '@renderer/ui/thumbnailSize';
import styles from './SlideSurfaceView.module.css';

interface View {
  readonly mode: SlideSurfaceMode;
  readonly scale: number;
  readonly windowKind: 'control' | 'song';
}
const useView = create<View>(() => ({
  mode: 'list',
  scale: 100,
  windowKind: 'control',
}));
/** Initializes this renderer window from the saved UI state. */
export function seedSlideSurfaceView(
  uiState: UiState,
  windowKind: 'control' | 'song' = 'control',
): void {
  const saved = uiState.layout?.normal;
  useView.setState({
    mode:
      (windowKind === 'song'
        ? saved?.songEditorSlideView
        : saved?.editorSlideView) ?? 'list',
    scale: clampThumbnailScale(
      (windowKind === 'song'
        ? saved?.songEditorSlideScalePercent
        : saved?.editorSlideScalePercent) ?? 100,
    ),
    windowKind,
  });
}
/** The current window's slide surface preference. */
export function useSlideSurfaceView(): View {
  return useView();
}
function update(next: Partial<View>): void {
  useView.setState(next);
}
function saveMode(
  mode: SlideSurfaceMode,
  ui: Pick<UiApi, 'setLayout'> | undefined,
): void {
  update({mode});
  ui?.setLayout(
    useView.getState().windowKind === 'song'
      ? {sizeClass: 'normal', songEditorSlideView: mode}
      : {sizeClass: 'normal', editorSlideView: mode},
  );
}
function saveScale(
  scale: number,
  ui: Pick<UiApi, 'setLayout'> | undefined,
): void {
  const whole = commitThumbnailScale(scale);
  update({scale: whole});
  ui?.setLayout(
    useView.getState().windowKind === 'song'
      ? {sizeClass: 'normal', songEditorSlideScalePercent: whole}
      : {sizeClass: 'normal', editorSlideScalePercent: whole},
  );
}
export function SlideSurfaceView({
  ui,
}: {
  readonly ui?: Pick<UiApi, 'setLayout'> | undefined;
}): JSX.Element {
  const current = useSlideSurfaceView();
  return (
    <div role="toolbar" aria-label="슬라이드 보기" className={styles.toolbar}>
      <SegmentedControl
        kind="toggle"
        label={'\uC2AC\uB77C\uC774\uB4DC \uBCF4\uAE30 \uBC29\uC2DD'}
        options={[
          {value: 'list', label: '\uBAA9\uB85D', icon: 'rows'},
          {value: 'grid', label: '\uACA9\uC790', icon: 'grid'},
        ]}
        value={current.mode}
        onChange={mode => saveMode(mode, ui)}
      />
      {current.mode === 'grid' ? (
        <ThumbnailSizeControl
          compact
          value={current.scale}
          onChange={scale => update({scale: clampThumbnailScale(scale)})}
          onCommit={scale => saveScale(scale, ui)}
        />
      ) : null}
    </div>
  );
}
