import {useId, type JSX} from 'react';
import {continues, withContinued} from '@core/slides';
import {Checkbox} from '@renderer/ui/choices/Checkbox';
import {changeSelected, type ChosenSlides} from './changeSelected';
import styles from './SlideInspector.module.css';

/**
 * Whether the selected Bible slides end with ` (계속)`: a part of a verse that
 * goes on in the next slide. Turning it off hides the marker only; the verse
 * stays cut where it is. Null when no selected slide holds a verse.
 */
export function ContinuedRow({deck, chosen}: ChosenSlides): JSX.Element | null {
  const id = useId();
  const verses = chosen.filter(slide => slide.verse !== undefined);
  if (verses.length === 0) return null;
  const states = verses.map(slide => continues(slide));
  const on = states.some(Boolean);
  return (
    <div className={styles.check}>
      <Checkbox
        id={id}
        checked={!on ? false : states.every(Boolean) ? true : 'mixed'}
        disabled={deck.readOnly}
        onChange={value =>
          changeSelected(deck, slide =>
            slide.verse === undefined ? slide : withContinued(slide, value),
          )
        }
      />
      <label htmlFor={id}>끝에 (계속) 붙이기</label>
    </div>
  );
}
