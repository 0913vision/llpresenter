/** Whether a slide size is 16:9, within 1 percent. */
export function isPowerPointWidescreen(width: number, height: number): boolean {
  return Math.abs(width * 9 - height * 16) * 100 <= height * 16;
}

/** Matches standard 4:3 slides, allowing for rounded Office dimensions. */
export function isPowerPointFourThree(width: number, height: number): boolean {
  return Math.abs(width * 3 - height * 4) * 1000 <= height * 4;
}
