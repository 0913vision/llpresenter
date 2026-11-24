import type {JSX} from 'react';
import {SegmentedControl} from './SegmentedControl';

/** How a list shows its items: as rows, or as a grid of tiles. */
export type ViewMode = 'list' | 'grid';

const OPTIONS = [
  {value: 'list', label: '목록 보기', icon: 'rows'},
  {value: 'grid', label: '격자 보기', icon: 'grid'},
] as const;

/**
 * The 목록 and 격자 icons of a list that can also show as a grid. It sits in
 * the bottom row of its panel, left of the size slider.
 */
export function ViewModeSwitch({
  label,
  value,
  onChange,
}: {
  /** Names what is shown, such as "슬라이드 보기 방식". */
  readonly label: string;
  readonly value: ViewMode;
  readonly onChange: (value: ViewMode) => void;
}): JSX.Element {
  return (
    <SegmentedControl
      kind="toggle"
      label={label}
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
