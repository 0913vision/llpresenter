/** The two control heights: sm (26) in panels, md (30) in dialogs. */
export type ControlSize = 'sm' | 'md';

/** Names a group with its own text or by pointing at a visible label. */
export type GroupName =
  | {readonly label: string; readonly labelledBy?: undefined}
  | {readonly labelledBy: string; readonly label?: undefined};
