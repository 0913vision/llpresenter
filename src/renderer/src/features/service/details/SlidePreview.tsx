import {useState, type JSX, type ReactNode} from 'react';
import type {Screen} from '@core/schema/screens';
import type {LabelColor} from '@core/labels/colors';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import styles from './SlidePreview.module.css';

/** The screen selected for a local slide preview. */
export function usePreviewScreen(screens: readonly Screen[]) {
  const [selected, setSelected] = useState<string | null>(null);
  const target =
    screens.find(screen => screen.id === selected) ??
    screens.find(screen => screen.kind === 'audience') ??
    screens[0];
  const choices = screens.map(screen => ({
    value: screen.id,
    label:
      screens.filter(other => other.kind === screen.kind).length === 1
        ? ({audience: '청중', stage: '무대', broadcast: '방송'} as const)[
            screen.kind
          ]
        : screen.name,
  }));
  return {target, choices, setSelected};
}

/** The shared local picture, screen selector and selected-slide band. */
export function SlidePreview({
  picture,
  screen,
  number,
  label,
  color,
}: {
  readonly picture: ReactNode;
  readonly screen: ReturnType<typeof usePreviewScreen>;
  readonly number?: number | undefined;
  readonly label?: string | undefined;
  readonly color?: LabelColor | undefined;
}): JSX.Element {
  return (
    <>
      <div className={styles.picture} data-background-picture>
        {picture}
      </div>
      {screen.target === undefined ? null : (
        <SegmentedControl
          label="미리보기 화면"
          fill
          options={screen.choices}
          value={screen.target.id}
          onChange={screen.setSelected}
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
