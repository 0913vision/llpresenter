import {useState, type JSX} from 'react';
import {nextTextOfTile} from '@core/presentation';
import {hidesNext} from '@core/slides';
import type {ScreenId} from '@core/schema/common/ids';
import type {ShowTile} from '@core/schema/services/showService';
import {KIND_NAMES} from '@core/screens';
import {themeOfTile, useThemes} from '@renderer/platform/documents/themes';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {SlideThumbnailBand} from '@renderer/ui/tiles/SlideThumbnail';
import styles from './SlidePreview.module.css';
import {SCREEN_KIND_ORDER} from '@core/schema/screens/screens';

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
    after === undefined
      ? nextAtEnd
      : hidesNext(tile.slide)
        ? null
        : nextTextOfTile(after, themeOfTile);
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
