export function applyDirty(
  frame: Buffer,
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
    data: Uint8Array;
  },
  size: {width: number; height: number},
): void;
