import {open, type FileHandle} from 'node:fs/promises';

async function readChunk(
  file: FileHandle,
  bytes: Buffer,
  {size, offset}: {readonly size: number; readonly offset: number},
): Promise<number> {
  let read = 0;
  while (read < size) {
    const result = await file.read(bytes, read, size - read, offset + read);
    if (result.bytesRead === 0) break;
    read += result.bytesRead;
  }
  return read;
}

async function compare(
  source: FileHandle,
  target: FileHandle,
): Promise<boolean> {
  const a = await source.stat();
  const b = await target.stat();
  if (!a.isFile() || !b.isFile() || a.size !== b.size) return false;
  const left = Buffer.alloc(64 * 1024);
  const right = Buffer.alloc(64 * 1024);
  for (let offset = 0; offset < a.size; offset += left.length) {
    const size = Math.min(left.length, a.size - offset);
    const x = await readChunk(source, left, {size, offset});
    const y = await readChunk(target, right, {size, offset});
    if (
      x !== size ||
      y !== size ||
      !left.subarray(0, size).equals(right.subarray(0, size))
    ) {
      return false;
    }
  }
  const sourceAfter = await source.stat();
  const after = await target.stat();
  return (
    sourceAfter.size === a.size &&
    sourceAfter.mtimeMs === a.mtimeMs &&
    after.size === b.size &&
    after.mtimeMs === b.mtimeMs
  );
}

/** Compares actual bytes in bounded chunks, ignoring missing candidate files. */
export async function sameImage(
  first: string,
  second: string,
): Promise<boolean> {
  const source = await open(first, 'r');
  try {
    const target = await open(second, 'r');
    try {
      return await compare(source, target);
    } finally {
      await target.close();
    }
  } catch {
    return false;
  } finally {
    await source.close();
  }
}
