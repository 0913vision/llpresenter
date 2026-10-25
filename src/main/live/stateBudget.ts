import {Buffer} from 'node:buffer';
import {LIVE_STATE_BYTE_BUDGET} from '@shared/schema/liveLimits';
import {isJsonObject} from '@shared/schema/primitives';

const MAX_DEPTH = 64;
const JSON_INDENT = 2;
const MAX_JSON_BYTES_PER_CODE_UNIT = 6;
const QUOTES = 2;
const MAX_CACHED_STRINGS = 256;
const MAX_CACHED_STRING_CHARACTERS = 128;
const SAFE_JSON_TEXT =
  /^[\u0020-\u0021\u0023-\u005b\u005d-\ud7ff\ue000-\uffff]*$/;

type CountMode = 'upperBound' | 'exact';

function stringBytes(text: string, mode: CountMode): number {
  if (mode === 'upperBound') {
    return QUOTES + text.length * MAX_JSON_BYTES_PER_CODE_UNIT;
  }
  if (SAFE_JSON_TEXT.test(text)) {
    return QUOTES + Buffer.byteLength(text, 'utf8');
  }
  let bytes = QUOTES;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) bytes += 2;
    else if (code < 0x20) bytes += [8, 9, 10, 12, 13].includes(code) ? 2 : 6;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < text.length &&
      text.charCodeAt(index + 1) >= 0xdc00 &&
      text.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index++;
    } else if (code >= 0xd800 && code <= 0xdfff) bytes += 6;
    else bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
  }
  return bytes;
}

class StateSizeCounter {
  private readonly ancestors = new Set<object>();
  private readonly strings: Map<string, number> | undefined;

  constructor(private readonly mode: CountMode) {
    this.strings = mode === 'exact' ? new Map() : undefined;
  }

  private textBytes(text: string): number {
    if (
      this.strings === undefined ||
      text.length > MAX_CACHED_STRING_CHARACTERS
    ) {
      return stringBytes(text, this.mode);
    }
    const known = this.strings.get(text);
    if (known !== undefined) return known;
    const bytes = stringBytes(text, this.mode);
    if (this.strings.size < MAX_CACHED_STRINGS) {
      this.strings.set(text, bytes);
    }
    return bytes;
  }

  bytes(value: unknown, depth: number): number {
    if (typeof value === 'string') return this.textBytes(value);
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value).length : 4;
    }
    if (typeof value === 'boolean') return value ? 4 : 5;
    if (value === null || value === undefined) return 4;
    if (
      typeof value !== 'object' ||
      depth > MAX_DEPTH ||
      this.ancestors.has(value)
    ) {
      return Infinity;
    }
    if (!Array.isArray(value) && !isJsonObject(value)) return Infinity;
    this.ancestors.add(value);
    let bytes = 2;
    let count = 0;
    if (Array.isArray(value)) {
      const items: readonly unknown[] = value;
      count = items.length;
      for (const item of items) {
        bytes += this.bytes(item, depth + 1);
        if (bytes > LIVE_STATE_BYTE_BUDGET) break;
      }
    } else {
      for (const [key, item] of Object.entries(value)) {
        if (item === undefined) continue;
        count++;
        bytes += this.textBytes(key) + 2 + this.bytes(item, depth + 1);
        if (bytes > LIVE_STATE_BYTE_BUDGET) break;
      }
    }
    this.ancestors.delete(value);
    return count === 0
      ? bytes
      : bytes +
          2 * count +
          JSON_INDENT * (depth + 1) * count +
          JSON_INDENT * depth;
  }
}

/** Counts recovery's state frame without materializing JSON or an encoded copy. */
export function liveStateBytes(
  state: unknown,
  mode: CountMode = 'exact',
): number {
  return new StateSizeCounter(mode).bytes({state}, 0) + 1;
}

/** Short ordinary states pass using lengths only; large states count UTF-8 and escapes. */
export function fitsLiveStateByteBudget(state: unknown): boolean {
  return (
    liveStateBytes(state, 'upperBound') <= LIVE_STATE_BYTE_BUDGET ||
    liveStateBytes(state) <= LIVE_STATE_BYTE_BUDGET
  );
}
