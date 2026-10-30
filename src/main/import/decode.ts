import type {Result} from '@core/common/result';
import type {
  TextImportFailure,
  TextImportReadRequest,
} from '@core/schema/textImport';
import {decode as decodeLegacy} from 'iconv-lite';

type Encoding = TextImportReadRequest['encoding'];

function decode(bytes: Uint8Array, label: string): string {
  return new TextDecoder(label, {fatal: true}).decode(bytes);
}

function decodeCp949(bytes: Uint8Array): string {
  return decodeLegacy(Buffer.from(bytes), 'cp949');
}

function bomEncoding(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return null;
}

function decodeAuto(bytes: Uint8Array): string {
  const bom = bomEncoding(bytes);
  if (bom !== null) return decode(bytes, bom);
  try {
    return decode(bytes, 'utf-8');
  } catch {
    return decodeCp949(bytes);
  }
}

/** Decodes strict text; auto uses a BOM, then UTF-8, then Windows CP949. */
export function decodeTextImport(
  bytes: Uint8Array,
  encoding: Encoding,
): Result<string, TextImportFailure> {
  try {
    const text =
      encoding === 'auto'
        ? decodeAuto(bytes)
        : encoding === 'cp949'
          ? decodeCp949(bytes)
          : decode(bytes, 'utf-8');
    if (text.includes('\uFFFD')) {
      throw new Error('The decoded text contains replacement characters');
    }
    return {ok: true, value: text};
  } catch {
    return {
      ok: false,
      error: {
        reason: 'decode-failed',
        message: 'The text contains invalid bytes for its encoding',
      },
    };
  }
}
