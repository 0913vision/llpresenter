import {describe, expect, it} from 'vitest';
import {parseRecord, parseSample, RECORD_VERSION} from './record.mts';

const validLine = {
  v: RECORD_VERSION,
  elapsedMs: 10_000,
  processes: [{name: 'main', pid: 42, workingSetKb: 90_000, privateKb: 80_000}],
  outputs: [{screen: 'main', fps: 59.9}],
};

function withChange(change: Record<string, unknown>): unknown {
  return {...validLine, ...change};
}

describe('parseSample', () => {
  it('accepts a valid line', () => {
    expect(parseSample(validLine)).toEqual({
      ok: true,
      value: {
        elapsedMs: 10_000,
        processes: validLine.processes,
        outputs: validLine.outputs,
      },
    });
  });

  it.each([
    ['another format version', withChange({v: 2})],
    ['a negative elapsed time', withChange({elapsedMs: -1})],
    ['processes that are not a list', withChange({processes: {}})],
    [
      'a process without a name',
      withChange({processes: [{pid: 1, workingSetKb: 1, privateKb: 1}]}),
    ],
    [
      'a process with memory that is not a number',
      withChange({
        processes: [{name: 'gpu', pid: 1, workingSetKb: '1', privateKb: 1}],
      }),
    ],
    ['an output with a bad fps', withChange({outputs: [{screen: 'main'}]})],
    ['a list instead of an object', [validLine]],
  ])('rejects %s', (_label, value) => {
    expect(parseSample(value).ok).toBe(false);
  });
});

describe('parseRecord', () => {
  it('reads every line and skips blank ones, with either line ending', () => {
    const line = JSON.stringify(validLine);
    const {samples, problems} = parseRecord(`${line}\r\n\n${line}\n`);
    expect(samples).toHaveLength(2);
    expect(problems).toEqual([]);
  });

  it('drops only the bad lines and says where they are', () => {
    const line = JSON.stringify(validLine);
    const text = [line, '{"v": 1, broken', line, '{"v": 9}'].join('\n');
    const {samples, problems} = parseRecord(text);
    expect(samples).toHaveLength(2);
    expect(problems.map(p => p.line)).toEqual([2, 4]);
    expect(problems[0]?.reason).toMatch(/^not JSON/);
  });
});
