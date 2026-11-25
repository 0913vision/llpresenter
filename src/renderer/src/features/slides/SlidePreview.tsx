import type {JSX} from 'react';
import {create} from 'zustand';
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

/** The choice that shows every screen at once, as 진행's preview has it. */
const ALL_SCREENS = 'all';

/**
 * The screen the previews of 준비 show, one for all its panels: a screen's
 * id, or every screen at once (USER Nov 25: "고를 수 있게 해 줘. 진행처럼.").
 */
const usePreviewChoice = create<{readonly selected: string | null}>(() => ({
  selected: null,
}));

/** One screen a preview draws. */
export interface PreviewView {
  readonly id: ScreenId | undefined;
  readonly role: (typeof SCREEN_KIND_ORDER)[number];
  /** Its name under the picture when every screen shows; none for one. */
  readonly name?: string | undefined;
}

/** The screen a panel shows its slides on, and the others it can show. */
export function usePreviewScreen() {
  const screens = useThemes(view => view.screens);
  const selected = usePreviewChoice(view => view.selected);
  const ordered = SCREEN_KIND_ORDER.flatMap(kind =>
    screens.filter(screen => screen.kind === kind),
  );
  const nameOf = (screen: (typeof ordered)[number]): string =>
    ordered.filter(({kind}) => kind === screen.kind).length === 1
      ? KIND_NAMES[screen.kind]
      : screen.name;
  const all = selected === ALL_SCREENS && ordered.length > 1;
  const shown = ordered.find(({id}) => id === selected) ?? ordered[0];
  const views: readonly PreviewView[] = all
    ? ordered.map(screen => ({
        id: screen.id,
        role: screen.kind,
        name: nameOf(screen),
      }))
    : [{id: shown?.id, role: shown?.kind ?? 'audience'}];
  return {
    id: shown?.id,
    /** The choice that is on: a screen's id, or every screen. */
    value: all ? ALL_SCREENS : (shown?.id ?? ''),
    views,
    select: (value: string): void => {
      usePreviewChoice.setState({selected: value});
    },
    choices: [
      ...ordered.map(screen => ({value: screen.id, label: nameOf(screen)})),
      ...(ordered.length > 1 ? [{value: ALL_SCREENS, label: '전체'}] : []),
    ],
  };
}

/**
 * What a preview shows: the screens it draws, the choice that is on, the call
 * that chooses another, and the choices.
 */
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
      <div className={styles.screens}>
        {screen.views.map(view => (
          <div key={view.id ?? 'none'} className={styles.screen}>
            <div className={styles.picture} data-background-picture>
              {tile === undefined ? null : (
                <PreviewPicture
                  tiles={tiles}
                  index={index}
                  view={view}
                  nextAtEnd={nextAtEnd}
                />
              )}
            </div>
            {view.name === undefined ? null : (
              <div className={styles.name}>{view.name}</div>
            )}
          </div>
        ))}
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

/** The picture of a slide of a list on one screen. */
export function PreviewPicture({
  tiles,
  index,
  view: {id, role},
  nextAtEnd,
}: Omit<Parameters<typeof SlidePreview>[0], 'screen'> & {
  readonly view: PreviewView;
}): JSX.Element | null {
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
