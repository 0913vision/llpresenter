// TODO(0913vision): Import LabelColor from src/shared/ once the lead adds the
// 이름표 list schema there.
/** An 이름표 color the user picked, or none. */
export type LabelColor =
  | 'teal'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'rose'
  | 'violet'
  | 'slate'
  | 'gray'
  | 'none';

/** The CSS value of the token for an 이름표 color, such as `var(--label-teal)`. */
export function labelColorValue(color: LabelColor): string {
  return `var(--label-${color})`;
}
