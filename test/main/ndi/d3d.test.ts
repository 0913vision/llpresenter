import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe, expect, it, vi} from 'vitest';

interface NativeCall {
  slot: number;
  owner: unknown;
  args: unknown[];
}
interface Reader {
  read: (
    ...args: [
      pid: number,
      handle: string,
      dirty: {x: number; y: number; width: number; height: number},
      consume: (value: unknown) => void,
    ]
  ) => void;
  close: () => void;
}

function setOut(value: unknown, result: string): void {
  if (!Array.isArray(value)) throw new Error('Expected output pointer');
  Reflect.set(value, 0, result);
}

describe('D3D11 bridge', () => {
  it('calls the COM slots with the expected descriptors, copy and release arguments', () => {
    const calls: NativeCall[] = [];
    const close = vi.fn<(...args: unknown[]) => void>();
    const memcpy = vi.fn();
    const functions: Record<string, (...args: unknown[]) => unknown> = {
      D3D11CreateDevice: (...args) => {
        setOut(args[7], 'device');
        setOut(args[9], 'context');
        return 0;
      },
      OpenProcess: () => 'process',
      GetCurrentProcess: () => 'current',
      DuplicateHandle: (...args) => {
        setOut(args[3], 'duplicate');
        return 1;
      },
      CloseHandle: close,
      GetLastError: () => 0,
      memcpy,
    };
    const koffi = {
      load: () => ({func: (name: string) => functions[name]}),
      pointer: (name: string) => name,
      out: (name: string) => name,
      proto: (name: string) => name,
      decode: (value: unknown, offset: unknown) => {
        if (Buffer.isBuffer(value)) return 4096n;
        if (typeof offset === 'number') return {slot: offset / 8};
        return {owner: value};
      },
      call: (
        ...[entry, , owner, ...args]: [
          entry: {slot: number},
          type: unknown,
          owner: unknown,
          ...args: unknown[],
        ]
      ) => {
        calls.push({slot: entry.slot, owner, args});
        if (entry.slot === 0) setOut(args[1], 'device1');
        if (entry.slot === 48) setOut(args[2], 'texture');
        if (entry.slot === 5) setOut(args[2], 'staging');
        if (entry.slot === 10) {
          const desc = args[0];
          if (!Buffer.isBuffer(desc)) throw new Error('Expected descriptor');
          desc.writeUInt32LE(2, 0);
          desc.writeUInt32LE(2, 4);
          desc.writeUInt32LE(87, 16);
        }
        if (entry.slot === 14) {
          const mapped = args[4];
          if (!Buffer.isBuffer(mapped)) throw new Error('Expected mapped data');
          mapped.writeUInt32LE(8, 8);
        }
        return 0;
      },
    };
    const source = readFileSync(
      new URL('../../../src/main/ndi/d3d.cjs', import.meta.url),
      'utf8',
    );
    const module: {exports: {create: () => Reader}} = {
      exports: {
        create: () => {
          throw new Error('not loaded');
        },
      },
    };
    runInNewContext(source, {
      module,
      require: (name: string) => (name === 'koffi' ? koffi : {Buffer}),
      Buffer,
    });
    const reader = module.exports.create();
    const consume = vi.fn();
    reader.read(12, '01', {x: 0, y: 0, width: 2, height: 2}, consume);
    reader.close();
    expect(
      calls.map(({slot, owner, args}) => [slot, owner, args.length]),
    ).toEqual([
      [0, 'device', 2],
      [48, 'device1', 3],
      [10, 'texture', 1],
      [5, 'device', 3],
      [46, 'context', 8],
      [14, 'context', 5],
      [15, 'context', 2],
      [2, 'texture', 0],
      [2, 'staging', 0],
      [2, 'device1', 0],
      [2, 'context', 0],
      [2, 'device', 0],
    ]);
    const desc = calls.find(call => call.slot === 5)?.args[0];
    if (!Buffer.isBuffer(desc)) throw new Error('Expected staging descriptor');
    expect(desc.length).toBe(44);
    expect(desc.readUInt32LE(28)).toBe(3);
    expect(desc.readUInt32LE(36)).toBe(0x20000);
    expect(calls.find(call => call.slot === 48)?.args.slice(0, 1)).toEqual([
      'duplicate',
    ]);
    expect(calls.find(call => call.slot === 46)?.args.slice(0, 8)).toEqual([
      'staging',
      0,
      0,
      0,
      0,
      'texture',
      0,
      expect.any(Buffer),
    ]);
    expect(calls.find(call => call.slot === 14)?.args.slice(0, 4)).toEqual([
      'staging',
      0,
      1,
      0,
    ]);
    expect(memcpy).toHaveBeenCalledOnce();
    expect(consume).toHaveBeenCalledOnce();
    expect(close.mock.calls.map(call => call[0])).toEqual([
      'duplicate',
      'process',
    ]);
  });
});
