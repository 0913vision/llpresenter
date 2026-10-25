import {open, type FileHandle} from 'node:fs/promises';
import {basename} from 'node:path';
import type {Result} from '@shared/result';
import type {
  TextImportFailure,
  TextImportReadRequest,
  TextImportReadResult,
} from '@shared/schema/textImport';
import {decodeTextImport} from './decode';
import {TEXT_IMPORT_LIMITS} from './limits';

const READ_CHUNK_BYTES = 64 * 1024;

export interface TextImportInputs {
  readonly chooseFile: () => Promise<string | null>;
  readonly readClipboard: () => Promise<string>;
}

function failure(
  reason: TextImportFailure['reason'],
  message: string,
): {readonly ok: false; readonly error: TextImportFailure} {
  return {ok: false, error: {reason, message}};
}

async function readOpenedFile(
  file: FileHandle,
): Promise<Result<Uint8Array, TextImportFailure>> {
  const info = await file.stat();
  if (!info.isFile()) {
    return failure('read-failed', 'The selected path is not a regular file');
  }
  if (info.size > TEXT_IMPORT_LIMITS.bytes) {
    return failure('invalid', 'The text file exceeds its size limit');
  }
  const bytes = Buffer.alloc(Math.min(info.size, TEXT_IMPORT_LIMITS.bytes) + 1);
  let size = 0;
  while (size < bytes.length) {
    const {bytesRead} = await file.read(
      bytes,
      size,
      Math.min(READ_CHUNK_BYTES, bytes.length - size),
      null,
    );
    if (bytesRead === 0) break;
    size += bytesRead;
  }
  if (size > TEXT_IMPORT_LIMITS.bytes) {
    return failure('invalid', 'The text file exceeds its size limit');
  }
  if (size > info.size) {
    return failure('read-failed', 'The text file grew while it was read');
  }
  return {ok: true, value: bytes.subarray(0, size)};
}

async function readFileBytes(
  path: string,
): Promise<Result<Uint8Array, TextImportFailure>> {
  try {
    const file = await open(path, 'r');
    try {
      return await readOpenedFile(file);
    } finally {
      await file.close();
    }
  } catch (error: unknown) {
    return failure(
      'read-failed',
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Reads one retained source. Cancellation has a null value; no file is changed. */
export async function readTextImport(
  request: TextImportReadRequest,
  inputs: TextImportInputs,
): Promise<TextImportReadResult> {
  try {
    if (request.source === 'clipboard') {
      const text = await inputs.readClipboard();
      if (text.length > TEXT_IMPORT_LIMITS.characters) {
        return failure('invalid', 'The clipboard text exceeds its size limit');
      }
      if (text.includes('\uFFFD')) {
        return failure(
          'decode-failed',
          'The clipboard text contains replacement characters',
        );
      }
      if (text.trim() === '') {
        return failure('empty', 'The clipboard has no text');
      }
      return {ok: true, value: {source: 'clipboard', fileName: null, text}};
    }
    const path = await inputs.chooseFile();
    if (path === null) return {ok: true, value: null};
    const bytes = await readFileBytes(path);
    if (!bytes.ok) return bytes;
    const decoded = decodeTextImport(bytes.value, request.encoding);
    if (!decoded.ok) return decoded;
    if (decoded.value.length > TEXT_IMPORT_LIMITS.characters) {
      return failure('invalid', 'The decoded text exceeds its size limit');
    }
    return {
      ok: true,
      value: {source: 'file', fileName: basename(path), text: decoded.value},
    };
  } catch (error: unknown) {
    return failure(
      'read-failed',
      error instanceof Error ? error.message : String(error),
    );
  }
}
