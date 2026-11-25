import {createHash} from 'node:crypto';
import {open, writeFile} from 'node:fs/promises';
import {POWERPOINT_IMPORT_LIMITS} from '@core/schema/songs/textImportLimits';
import {readPowerPoint, readPowerPointSize} from './powerpointDeck';
import {PowerPointZip} from './powerpointZip';
import type {PowerPointJob} from './powerpointJob';

/** Checks what the worker was asked; it throws on anything else. */
export function parseJob(value: unknown): PowerPointJob {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('kind' in value) ||
    !('path' in value) ||
    typeof value.path !== 'string'
  ) {
    throw new Error('Invalid PowerPoint worker request');
  }
  if (value.kind === 'read') return {kind: 'read', path: value.path};
  if (value.kind === 'size') return {kind: 'size', path: value.path};
  if (
    value.kind === 'pictures' &&
    'digest' in value &&
    typeof value.digest === 'string' &&
    'pictures' in value &&
    Array.isArray(value.pictures)
  ) {
    const listed: readonly unknown[] = value.pictures;
    const pictures = listed.map(item => {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('part' in item) ||
        typeof item.part !== 'string' ||
        !('target' in item) ||
        typeof item.target !== 'string'
      ) {
        throw new Error('Invalid PowerPoint picture');
      }
      return {part: item.part, target: item.target};
    });
    return {
      kind: 'pictures',
      path: value.path,
      digest: value.digest,
      pictures,
    };
  }
  throw new Error('Invalid PowerPoint worker request');
}

/**
 * Reads a whole file, up to the PowerPoint size limit; it throws when the
 * file is too big, not a file, or changes while it is read.
 */
export async function readBounded(path: string): Promise<Buffer> {
  await using file = await open(path, 'r');
  const info = await file.stat();
  if (!info.isFile() || info.size > POWERPOINT_IMPORT_LIMITS.bytes) {
    throw new Error('PowerPoint file exceeds its size limit');
  }
  const bytes = Buffer.alloc(info.size + 1);
  let length = 0;
  while (length < bytes.length) {
    const {bytesRead} = await file.read(
      bytes,
      length,
      Math.min(65536, bytes.length - length),
      null,
    );
    if (bytesRead === 0) break;
    length += bytesRead;
  }
  if (length !== info.size) {
    throw new Error('PowerPoint file changed while reading');
  }
  return bytes.subarray(0, length);
}

/**
 * Does one job on a PowerPoint file: its slide size, its slides, or its
 * pictures written to their targets. A job on a file that was read before
 * throws when the file has changed since.
 *
 * @returns What the worker answers.
 */
export async function runPowerPointJob(job: PowerPointJob): Promise<unknown> {
  const bytes = await readBounded(job.path);
  if (job.kind === 'size') return readPowerPointSize(bytes);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (job.kind !== 'read' && digest !== job.digest) {
    throw new Error('PowerPoint file changed after preview');
  }
  if (job.kind === 'pictures') {
    const zip = new PowerPointZip(bytes);
    for (const {part, target} of job.pictures) {
      const image = zip.read(part);
      if (!image) throw new Error('PowerPoint picture is unavailable');
      await writeFile(target, image, {flag: 'wx'});
    }
    return true;
  }
  const deck = readPowerPoint(bytes);
  return {
    digest,
    slides: deck.slides,
    widescreen: deck.widescreen,
    width: deck.width,
    height: deck.height,
  };
}
