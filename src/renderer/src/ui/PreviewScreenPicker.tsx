import type {JSX} from 'react';
import {SegmentedControl} from './SegmentedControl';
import {SelectMenu} from './SelectMenu';
import styles from './PreviewScreenPicker.module.css';

const MOST_SEGMENTS = 3;
const LONGEST_SEGMENT_NAME = 6;

/**
 * Chooses the screen shown large, in the panel header, when a short column has
 * no room for the row of small tiles. A few short names are segments; more
 * screens or longer names are a select, which cannot push a choice out of reach.
 */
export function PreviewScreenPicker<Id extends string>({
  screens,
  big,
  onChange,
}: {
  readonly screens: ReadonlyArray<{readonly id: Id; readonly name: string}>;
  readonly big: Id;
  readonly onChange: (id: Id) => void;
}): JSX.Element {
  const options = screens.map(screen => ({
    value: screen.id,
    label: screen.name,
  }));
  const fits =
    screens.length <= MOST_SEGMENTS &&
    screens.every(screen => screen.name.length <= LONGEST_SEGMENT_NAME);
  return fits ? (
    <SegmentedControl
      className={styles.picker}
      label="미리보기 화면"
      options={options}
      value={big}
      onChange={onChange}
    />
  ) : (
    <span className={styles.select}>
      <SelectMenu
        block
        aria-label="미리보기 화면"
        menuLabel="미리보기 화면"
        options={options}
        value={big}
        onChange={onChange}
      />
    </span>
  );
}
