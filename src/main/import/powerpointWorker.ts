import {createHash} from 'node:crypto';
import {open, writeFile} from 'node:fs/promises';
import {parentPort, workerData} from 'node:worker_threads';
import {POWERPOINT_IMPORT_LIMITS} from '@core/songs/textImportLimits';
import {readPowerPoint} from './powerpointRead';
import {PowerPointZip} from './powerpointZip';
import type {PowerPointJob} from './powerpointJob';
import {sameImage} from './matchImage';

function parseJob(value: unknown): PowerPointJob {
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
  if (
    value.kind === 'match' &&
    'candidates' in value &&
    Array.isArray(value.candidates)
  ) {
    const candidates: readonly unknown[] = value.candidates;
    const valid: Array<{id: string; path: string}> = [];
    for (const item of candidates) {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('id' in item) ||
        typeof item.id !== 'string' ||
        !('path' in item) ||
        typeof item.path !== 'string'
      ) {
        throw new Error('Invalid media candidate');
      }
      valid.push({id: item.id, path: item.path});
    }
    return {kind: 'match', path: value.path, candidates: valid};
  }
  if (
    value.kind === 'background' &&
    'digest' in value &&
    typeof value.digest === 'string' &&
    'index' in value &&
    typeof value.index === 'number' &&
    Number.isSafeInteger(value.index) &&
    value.index >= 0 &&
    'target' in value &&
    typeof value.target === 'string'
  ) {
    return {
      kind: 'background',
      path: value.path,
      digest: value.digest,
      index: value.index,
      target: value.target,
    };
  }
  throw new Error('Invalid PowerPoint worker request');
}

async function readBounded(path: string): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
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
  } finally {
    await file.close();
  }
}

async function run(): Promise<void> {
  const input: unknown = workerData;
  const job = parseJob(input);
  if (job.kind === 'match') {
    for (const candidate of job.candidates) {
      if (await sameImage(job.path, candidate.path)) {
        parentPort?.postMessage(candidate.id);
        return;
      }
    }
    parentPort?.postMessage(null);
    return;
  }
  const bytes = await readBounded(job.path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (job.kind === 'background' && digest !== job.digest) {
    throw new Error('PowerPoint file changed after preview');
  }
  const deck = readPowerPoint(bytes);
  if (job.kind === 'read') {
    parentPort?.postMessage({digest, slides: deck.slides});
    return;
  }
  const part = deck.slides[job.index]?.background;
  if (!part) throw new Error('PowerPoint background is unavailable');
  const image = new PowerPointZip(bytes).read(part);
  if (!image) throw new Error('PowerPoint background is unavailable');
  await writeFile(job.target, image);
  parentPort?.postMessage(true);
}

run().catch((error: unknown) => {
  setImmediate(() => {
    throw error;
  });
});
