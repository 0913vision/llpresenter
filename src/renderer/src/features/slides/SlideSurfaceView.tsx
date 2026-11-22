import {create} from 'zustand';
import type {JSX} from 'react';
import type {UiState} from '@core/schema/uiState';
import type {UiApi} from '@contracts/ipc/ui';
import type {SlideSurfaceMode} from './useSlideRowWindow';
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
}
const useView = create<View>(() => ({
  mode: 'list',
  scale: 100,
}));
/** Takes the view that was saved on this computer. */
export function seedSlideSurfaceView(uiState: UiState): void {
  const saved = uiState.layout?.normal;
  useView.setState({
    mode: saved?.editorSlideView ?? 'list',
    scale: clampThumbnailScale(saved?.editorSlideScalePercent ?? 100),
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
  ui?.setLayout({sizeClass: 'normal', editorSlideView: mode});
}
function saveScale(
  scale: number,
  ui: Pick<UiApi, 'setLayout'> | undefined,
): void {
  const whole = commitThumbnailScale(scale);
  update({scale: whole});
  ui?.setLayout({sizeClass: 'normal', editorSlideScalePercent: whole});
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
        label={'슬라이드 보기 방식'}
        options={[
          {value: 'list', label: '목록', icon: 'rows'},
          {value: 'grid', label: '격자', icon: 'grid'},
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
