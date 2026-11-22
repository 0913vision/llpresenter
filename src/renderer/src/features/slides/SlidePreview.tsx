import {useState, type JSX} from 'react';
import {nextTextOfTile} from '@core/presentation/slideLayer';
import type {ScreenId} from '@core/schema/ids';
import type {ShowTile} from '@core/schema/showService';
import {KIND_NAMES, SCREEN_KIND_ORDER} from '@core/screens/screens';
import {themeOfTile, useThemes} from '@renderer/platform/themes';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import styles from './SlidePreview.module.css';

/** The screen a panel shows its slides on, and the others it can show. */
export function usePreviewScreen() {
  const screens = useThemes(view => view.screens);
  const [selected, select] = useState<ScreenId | null>(null);
  const ordered = SCREEN_KIND_ORDER.flatMap(kind =>
    screens.filter(screen => screen.kind === kind),
  );
  const shown = ordered.find(({id}) => id === selected) ?? ordered[0];
  return {
    id: shown?.id,
    role: shown?.kind ?? 'audience',
    select,
    choices: ordered.map(screen => ({
      value: screen.id,
      label:
        ordered.filter(({kind}) => kind === screen.kind).length === 1
          ? KIND_NAMES[screen.kind]
          : screen.name,
    })),
  };
}

export type PreviewScreen = ReturnType<typeof usePreviewScreen>;

/** A slide of a list on the chosen screen, as every side panel shows it. */
export function SlidePreview({
  tiles,
  index,
  screen,
  nextAtEnd,
}: {
  readonly tiles: readonly ShowTile[];
  readonly index: number;
  readonly screen: PreviewScreen;
  /** What the last slide of the list shows as its next text. */
  readonly nextAtEnd: string | null;
}): JSX.Element {
  const tile = tiles[index];
  return (
    <div className={styles.preview}>
      {screen.id === undefined ? null : (
        <SegmentedControl
          kind="toggle"
          label="화면"
          options={screen.choices}
          value={screen.id}
          onChange={screen.select}
        />
      )}
      <div className={styles.slide}>
        <div className={styles.picture} data-background-picture>
          {tile === undefined ? null : (
            <PreviewPicture
              tiles={tiles}
              index={index}
              screen={screen}
              nextAtEnd={nextAtEnd}
            />
          )}
        </div>
        {tile === undefined ? null : (
          <SlideThumbnailBand
            number={index + 1}
            label={tile.caption ?? undefined}
            labelColor={tile.labelColor}
          />
        )}
      </div>
    </div>
  );
}

/** The picture of a slide of a list on the chosen screen. */
export function PreviewPicture({
  tiles,
  index,
  screen: {id, role},
  nextAtEnd,
}: Parameters<typeof SlidePreview>[0]): JSX.Element | null {
  const tile = tiles[index];
  if (tile === undefined) return null;
  const after = tiles[index + 1];
  const next =
    after === undefined ? nextAtEnd : nextTextOfTile(after, themeOfTile, false);
  return (
    <div className={styles.canvas}>
      <TilePicture
        tile={tile}
        tiles={tiles}
        role={role}
        screenId={id}
        next={role === 'audience' ? null : next}
      />
    </div>
  );
}
