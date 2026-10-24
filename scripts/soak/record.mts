import {isJsonObject} from '../json.mts';

/** The version of the soak record format that this runner reads. */
export const RECORD_VERSION = 1;

/** One process's memory at one moment, from Electron's `app.getAppMetrics()`. */
export interface ProcessSample {
  /**
   * Stays the same across samples and relaunches: `main`, `control`, `gpu`,
   * `output:<screen id>`, or `utility:<name>`.
   */
  readonly name: string;
  readonly pid: number;
  readonly workingSetKb: number;
  readonly privateKb: number;
}

/** One output window's frame rate over the last sample interval. */
export interface OutputSample {
  readonly screen: string;
  readonly fps: number;
}

/** One line of the record: everything measured at one moment. */
export interface SoakSample {
  readonly elapsedMs: number;
  readonly processes: readonly ProcessSample[];
  readonly outputs: readonly OutputSample[];
}

/** A record line that was dropped, and why. */
export interface RecordProblem {
  readonly line: number;
  readonly reason: string;
}

/** The samples that passed validation and the lines that didn't. */
export interface ParsedRecord {
  readonly samples: readonly SoakSample[];
  readonly problems: readonly RecordProblem[];
}

type Parsed<T> =
  | {readonly ok: true; readonly value: T}
  | {readonly ok: false; readonly reason: string};

// TODO(0913vision): Switch these checks to valibot (docs/decisions.md) once
// it is a dependency.

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseProcess(value: unknown): Parsed<ProcessSample> {
  if (!isJsonObject(value)) {
    return {ok: false, reason: 'a process is not an object'};
  }
  const {name, pid, workingSetKb, privateKb} = value;
  if (!isName(name)) return {ok: false, reason: 'a process has no name'};
  if (!isAmount(pid) || !isAmount(workingSetKb) || !isAmount(privateKb)) {
    return {ok: false, reason: `process ${name} has a bad pid or memory value`};
  }
  return {ok: true, value: {name, pid, workingSetKb, privateKb}};
}

function parseOutput(value: unknown): Parsed<OutputSample> {
  if (!isJsonObject(value)) {
    return {ok: false, reason: 'an output is not an object'};
  }
  const {screen, fps} = value;
  if (!isName(screen)) return {ok: false, reason: 'an output has no screen'};
  if (!isAmount(fps)) {
    return {ok: false, reason: `output ${screen} has a bad fps`};
  }
  return {ok: true, value: {screen, fps}};
}

function parseList<T>(
  value: unknown,
  label: string,
  parseItem: (item: unknown) => Parsed<T>,
): Parsed<readonly T[]> {
  if (!Array.isArray(value)) {
    return {ok: false, reason: `${label} is not a list`};
  }
  const items: T[] = [];
  for (const item of value) {
    const parsed = parseItem(item);
    if (!parsed.ok) return parsed;
    items.push(parsed.value);
  }
  return {ok: true, value: items};
}

/**
 * Validates one decoded record line.
 *
 * @param value - the result of `JSON.parse` on the line
 */
export function parseSample(value: unknown): Parsed<SoakSample> {
  if (!isJsonObject(value)) {
    return {ok: false, reason: 'the line is not an object'};
  }
  if (value['v'] !== RECORD_VERSION) {
    return {ok: false, reason: `the format version is not ${RECORD_VERSION}`};
  }
  const {elapsedMs} = value;
  if (!isAmount(elapsedMs)) return {ok: false, reason: 'elapsedMs is bad'};
  const processes = parseList(value['processes'], 'processes', parseProcess);
  if (!processes.ok) return processes;
  const outputs = parseList(value['outputs'], 'outputs', parseOutput);
  if (!outputs.ok) return outputs;
  return {
    ok: true,
    value: {elapsedMs, processes: processes.value, outputs: outputs.value},
  };
}

function decodeLine(line: string): Parsed<unknown> {
  try {
    const value: unknown = JSON.parse(line);
    return {ok: true, value};
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    return {ok: false, reason: `not JSON (${reason})`};
  }
}

/**
 * Reads a JSON Lines record. A bad line is dropped and reported; the rest are
 * still judged.
 */
export function parseRecord(text: string): ParsedRecord {
  const samples: SoakSample[] = [];
  const problems: RecordProblem[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line.trim() === '') continue;
    const decoded = decodeLine(line);
    const parsed = decoded.ok ? parseSample(decoded.value) : decoded;
    if (parsed.ok) samples.push(parsed.value);
    else problems.push({line: index + 1, reason: parsed.reason});
  }
  return {samples, problems};
}
