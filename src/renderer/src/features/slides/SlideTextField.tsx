import {useId, type JSX} from 'react';
import {fillsItself} from '@core/slides';
import {Icon} from '@renderer/ui/Icon';
import {OwnTextButton} from './OwnTextButton';
import {SlideTextArea, type SlideBox} from './SlideTextArea';
import {useOwnText} from './useOwnText';
import styles from './SlideTextField.module.css';

/** A box of a slide with its name above its text. */
export function SlideTextField({
  alone = false,
  inList = false,
  note,
  ...place
}: SlideBox & {
  /** The only field of its slide, so its name says nothing. */
  readonly alone?: boolean;
  readonly inList?: boolean;
  /** Why the text does not show. */
  readonly note?: string | undefined;
}): JSX.Element {
  const id = useId();
  const {box, theme} = place;
  const filled = fillsItself(theme, box);
  const own = useOwnText(place);
  return (
    <div
      className={styles.field}
      data-alone={(alone && inList && !filled) || undefined}
    >
      {alone && !filled ? null : (
        <span className={styles.name}>
          <label htmlFor={id}>{box}</label>
          {filled ? <OwnTextButton own={own} /> : null}
        </span>
      )}
      <SlideTextArea
        {...place}
        id={id}
        label={alone && !filled ? box : undefined}
        inList={inList}
        locked={filled && !own.on}
      />
      {note === undefined ? null : (
        <span className={styles.note}>
          <Icon name="warning" size={14} />
          {note}
        </span>
      )}
    </div>
  );
}
