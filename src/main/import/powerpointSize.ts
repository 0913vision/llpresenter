/** Matches standard 4:3 slides, allowing for rounded Office dimensions. */
export function isPowerPointFourThree(width: number, height: number): boolean {
  return Math.abs(width * 3 - height * 4) * 1000 <= height * 4;
}
