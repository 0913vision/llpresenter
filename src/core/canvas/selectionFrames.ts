import type {ElementFrame} from './frameEdit';

export interface SelectedFrame {
  readonly id: string;
  readonly frame: ElementFrame;
}

/** Translates the group inside its bounds without changing the spaces between members. */
export function translateFrames(
  members: readonly SelectedFrame[],
  delta: {readonly x: number; readonly y: number},
  bounds: {readonly width: number; readonly height: number},
): readonly SelectedFrame[] {
  if (members.length === 0) return members;
  const left = Math.min(...members.map(row => row.frame.x));
  const top = Math.min(...members.map(row => row.frame.y));
  const right = Math.max(...members.map(row => row.frame.x + row.frame.w));
  const bottom = Math.max(...members.map(row => row.frame.y + row.frame.h));
  const x = Math.max(-left, Math.min(bounds.width - right, delta.x));
  const y = Math.max(-top, Math.min(bounds.height - bottom, delta.y));
  return members.map(row => ({
    id: row.id,
    frame: {...row.frame, x: row.frame.x + x, y: row.frame.y + y},
  }));
}
