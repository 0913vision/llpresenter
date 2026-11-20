import {useState, type JSX, type ReactNode} from 'react';
import type {Screen} from '@core/schema/screens';
import type {LabelColor} from '@core/labels/colors';
import {PreviewPanel} from '@renderer/ui/PreviewPanel';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import styles from './SlidePreview.module.css';

/** The screen selected for local slide thumbnails. */
export function usePreviewScreen(screens: readonly Screen[]) {
  const [selected, setSelected] = useState<string | null>(null);
  const target =
    screens.find(screen => screen.id === selected) ??
    screens.find(screen => screen.kind === 'audience') ??
    screens[0];
  return {target, setSelected};
}

/** Draw the selected slide on every configured screen. */
export function SlidePreview({
  screens,
  renderScreen,
  screen,
  number,
  label,
  color,
}: {
  readonly screens: readonly Screen[];
  readonly renderScreen: (screen: Screen) => ReactNode;
  readonly screen: ReturnType<typeof usePreviewScreen>;
  readonly number?: number | undefined;
  readonly label?: string | undefined;
  readonly color?: LabelColor | undefined;
}): JSX.Element {
  const [visible, setVisible] = useState(true);
  const previewScreens = screens.map(value => ({
    id: value.id,
    name: value.name,
    status: {kind: 'on' as const},
  }));
  return (
    <>
      {screen.target === undefined ? null : (
        <PreviewPanel
          screens={previewScreens}
          big={screen.target.id}
          onBigChange={screen.setSelected}
          alwaysShowTiles
          naturalHeight
          visible={visible}
          onVisibleChange={setVisible}
          renderScreen={value => {
            const target = screens.find(candidate => candidate.id === value.id);
            return target === undefined ? null : (
              <div className={styles.picture} data-background-picture>
                {renderScreen(target)}
              </div>
            );
          }}
        />
      )}
      {number === undefined ? null : (
        <div data-preview-band>
          <SlideThumbnailBand
            number={number}
            label={label}
            labelColor={color}
          />
        </div>
      )}
    </>
  );
}
