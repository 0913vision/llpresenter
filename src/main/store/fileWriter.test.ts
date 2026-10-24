import {describe, expect, it} from 'vitest';
import {FileWriter, type WriteFile, type WriteResult} from './fileWriter';

const SUCCESS: WriteResult = {ok: true, value: undefined};

interface PendingWrite {
  readonly file: string;
  readonly text: string;
  readonly finish: (result: WriteResult) => void;
}

/** A write function whose writes finish only when the test says so. */
function controlledWrites(): {write: WriteFile; pending: PendingWrite[]} {
  const pending: PendingWrite[] = [];
  const write: WriteFile = (file, text) =>
    new Promise(finish => pending.push({file, text, finish}));
  return {write, pending};
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('FileWriter', () => {
  it('writes one file at a time and lets the newest waiting text win', async () => {
    const {write, pending} = controlledWrites();
    const writer = new FileWriter(write);

    const first = writer.write('a.json', 'one');
    const second = writer.write('a.json', 'two');
    const third = writer.write('a.json', 'three');
    await settle();

    expect(pending.map(({text}) => text)).toEqual(['one']);
    pending.shift()?.finish(SUCCESS);
    await settle();
    expect(pending.map(({text}) => text)).toEqual(['three']);
    pending.shift()?.finish(SUCCESS);

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      SUCCESS,
      SUCCESS,
      SUCCESS,
    ]);
  });

  it('gives a replaced text the result of the write that replaced it', async () => {
    const {write, pending} = controlledWrites();
    const writer = new FileWriter(write);
    const failure: WriteResult = {
      ok: false,
      error: {file: 'a.json', message: 'disk full'},
    };

    const first = writer.write('a.json', 'one');
    const replaced = writer.write('a.json', 'two');
    const newest = writer.write('a.json', 'three');
    await settle();
    pending.shift()?.finish(SUCCESS);
    await settle();
    pending.shift()?.finish(failure);

    await expect(first).resolves.toEqual(SUCCESS);
    await expect(replaced).resolves.toEqual(failure);
    await expect(newest).resolves.toEqual(failure);
  });

  it('writes different files at the same time', async () => {
    const {write, pending} = controlledWrites();
    const writer = new FileWriter(write);

    const writes = [writer.write('a.json', 'a'), writer.write('b.json', 'b')];
    await settle();

    expect(pending.map(({file}) => file)).toEqual(['a.json', 'b.json']);
    pending.forEach(({finish}) => finish(SUCCESS));
    await expect(Promise.all(writes)).resolves.toEqual([SUCCESS, SUCCESS]);
  });

  it('turns a write function that throws into a failed result', async () => {
    const writer = new FileWriter(() => Promise.reject(new Error('boom')));

    await expect(writer.write('a.json', 'a')).resolves.toEqual({
      ok: false,
      error: {file: 'a.json', message: 'boom'},
    });
  });

  it('becomes idle once every write has finished', async () => {
    const {write, pending} = controlledWrites();
    const writer = new FileWriter(write);
    const writes = [
      writer.write('a.json', 'one'),
      writer.write('a.json', 'two'),
    ];
    let idle = false;

    const waiting = writer.idle().then(() => {
      idle = true;
    });
    await settle();
    pending.shift()?.finish(SUCCESS);
    await settle();
    expect(idle).toBe(false);
    pending.shift()?.finish(SUCCESS);
    await waiting;

    expect(idle).toBe(true);
    await expect(Promise.all(writes)).resolves.toEqual([SUCCESS, SUCCESS]);
  });
});
