import {useId, type JSX} from 'react';
import type {ShowTile} from '@core/schema/showService';
import {hidesNext, withHideNext} from '@core/slides';
import {Checkbox} from '@renderer/ui/choices/Checkbox';
import {changeSelected, type ChosenSlides} from './changeSelected';
import styles from './SlideInspector.module.css';

/** Whether the selected slides hide the one after them on 무대. */
export function HideNextRow({
  deck,
  chosen,
  tiles,
}: ChosenSlides & {readonly tiles: readonly ShowTile[]}): JSX.Element {
  const id = useId();
  const shown = new Set(tiles.map(tile => tile.slide.id));
  const states = chosen.flatMap(slide =>
    shown.has(slide.id) ? [hidesNext(slide)] : [],
  );
  const hidden = states.some(Boolean);
  return (
    <div className={styles.check}>
      <Checkbox
        id={id}
        checked={!hidden ? false : states.every(Boolean) ? true : 'mixed'}
        disabled={deck.readOnly}
        onChange={hide =>
          changeSelected(deck, slide =>
            shown.has(slide.id) ? withHideNext(slide, hide) : slide,
          )
        }
      />
      <label htmlFor={id}>다음 슬라이드 내용 숨기기</label>
    </div>
  );
}
