import {useId, type JSX} from 'react';
import type {ShowTile} from '@core/schema/showService';
import {hidesNext, hidesNextByDefault, withHideNext} from '@core/slides';
import {themeOfTile} from '@renderer/platform/themes';
import {Checkbox} from '@renderer/ui/Checkbox';
import {changeSelected, type ChosenSlides} from './changeSelected';
import styles from './SlideInspector.module.css';

/** Whether the selected slides show the one after them on 무대. */
export function ShowNextRow({
  deck,
  chosen,
  tiles,
}: ChosenSlides & {readonly tiles: readonly ShowTile[]}): JSX.Element {
  const id = useId();
  const places = new Map(
    tiles.map((tile, index) => [tile.slide.id, {tile, index}]),
  );
  const states = chosen.flatMap(slide => {
    const place = places.get(slide.id);
    return place === undefined
      ? []
      : [hidesNext(tiles, place.index, themeOfTile(place.tile))];
  });
  const none = !states.some(Boolean);
  return (
    <div className={styles.check}>
      <Checkbox
        id={id}
        checked={none ? true : states.every(Boolean) ? false : 'mixed'}
        disabled={deck.readOnly}
        onChange={show =>
          changeSelected(deck, slide => {
            const place = places.get(slide.id);
            return place === undefined
              ? slide
              : withHideNext(
                  slide,
                  !show,
                  hidesNextByDefault(
                    tiles,
                    place.index,
                    themeOfTile(place.tile),
                  ),
                );
          })
        }
      />
      <label htmlFor={id}>다음 슬라이드 내용 표시</label>
    </div>
  );
}
