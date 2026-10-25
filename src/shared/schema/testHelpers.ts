import * as v from 'valibot';
import {expect} from 'vitest';
import type {Result} from '../result';
import type {FileError, LoadedFile} from './fileFormat';

const UINT32_RANGE = 2 ** 32;
const HEX_RADIX = 16;
const UUID_VARIANT_MIN = 0x8;
const UUID_VARIANT_MAX = 0xb;

export function expectSuccess<T>(result: Result<T, FileError>): T {
  if (!result.ok) {
    throw new Error(`Expected success, got ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function expectFailure<T>(result: Result<T, FileError>): FileError {
  if (result.ok) {
    throw new Error(`Expected failure, got ${JSON.stringify(result.value)}`);
  }
  return result.error;
}

/** A format's parse and serialize functions, for the shared test steps. */
export interface FileCodec<T> {
  readonly parse: (
    text: string,
    file: string,
  ) => Result<LoadedFile<T>, FileError>;
  readonly serialize: (data: T, file: string) => Result<string, FileError>;
}

const TEST_FILE = 'test.json';

/** Expects the JSON to parse unchanged and to be written back unchanged. */
export function expectRoundTrip<T>(codec: FileCodec<T>, json: unknown): void {
  const loaded = expectSuccess(codec.parse(JSON.stringify(json), TEST_FILE));
  expect(loaded.data).toEqual(json);
  const text = expectSuccess(codec.serialize(loaded.data, TEST_FILE));
  expect(JSON.parse(text)).toEqual(json);
}

/** Expects the JSON to fail the schema at the given field. */
export function expectInvalidField<T>(
  codec: FileCodec<T>,
  json: unknown,
  field: string,
): void {
  const error = expectFailure(codec.parse(JSON.stringify(json), TEST_FILE));
  expect(error).toMatchObject({kind: 'invalid', field});
}

/** A seeded random source (mulberry32), so property loops repeat exactly. */
export class TestRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** A number in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  }

  /** An integer in [min, max]. */
  integer(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  boolean(): boolean {
    return this.integer(0, 1) === 1;
  }

  pick<T>(items: readonly [T, ...T[]]): T {
    return items[this.integer(0, items.length - 1)] ?? items[0];
  }

  /** A lowercase UUID v4. */
  uuid(): string {
    const hex = (count: number) =>
      Array.from({length: count}, () =>
        this.integer(0, HEX_RADIX - 1).toString(HEX_RADIX),
      ).join('');
    const variant = this.integer(UUID_VARIANT_MIN, UUID_VARIANT_MAX).toString(
      HEX_RADIX,
    );
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
  }
}

/**
 * A branded id for a test, such as a `ServiceId`, from a text that passes the
 * id's schema. Throws on any other text.
 */
export function testId<TSchema extends v.GenericSchema<string>>(
  schema: TSchema,
  value: string,
): v.InferOutput<TSchema> {
  return v.parse(schema, value);
}
