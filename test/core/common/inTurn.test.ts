import {describe, expect, it} from 'vitest';
import {InTurn, InTurnByKey} from '@core/common/inTurn';

function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>(resolve => {
    open = resolve;
  });
  return {opened, open};
}

describe('InTurn', () => {
  it('starts each work after the one before settled, in the order given, a failure included', async () => {
    const line = new InTurn();
    const log: string[] = [];
    const first = gate();
    const a = line.run(async () => {
      log.push('a start');
      await first.opened;
      log.push('a end');
      throw new Error('a failed');
    });
    const b = line.run(() => {
      log.push('b');
      return 2;
    });
    await Promise.resolve();
    expect(log).toEqual(['a start']);
    first.open();
    await expect(a).rejects.toThrow('a failed');
    expect(await b).toBe(2);
    expect(log).toEqual(['a start', 'a end', 'b']);
  });

  it('is idle once everything given has settled', async () => {
    const line = new InTurn();
    const first = gate();
    let done = false;
    const work = line.run(() => first.opened.then(() => (done = true)));
    const idle = line.idle();
    first.open();
    await idle;
    expect(done).toBe(true);
    await work;
  });
});

describe('InTurnByKey', () => {
  it('runs work of one key in turn, lets other keys go at once, and drops an empty line', async () => {
    const lines = new InTurnByKey<string>();
    const log: string[] = [];
    const held = gate();
    const a1 = lines.run('a', () => held.opened.then(() => log.push('a1')));
    const a2 = lines.run('a', () => log.push('a2'));
    const b1 = lines.run('b', () => log.push('b1'));
    await b1;
    expect(log).toEqual(['b1']);
    held.open();
    await Promise.all([a1, a2]);
    expect(log).toEqual(['b1', 'a1', 'a2']);
    await lines.idle('a');
    await Promise.resolve();
    expect(lines.size).toBe(0);
  });
});
