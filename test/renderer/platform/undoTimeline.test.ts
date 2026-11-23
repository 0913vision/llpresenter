import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  undoReason,
  undoTimeline,
  type UndoOwner,
} from '../../../src/renderer/src/platform/undoTimeline';

function owner(name: string, log: string[], works = true): UndoOwner {
  return {
    replay: kind => {
      log.push(`${name}:${kind}`);
      return Promise.resolve(works);
    },
  };
}

const report = vi.fn();
const owners: UndoOwner[] = [];
function made(name: string, log: string[], works = true): UndoOwner {
  const made = owner(name, log, works);
  owners.push(made);
  return made;
}

afterEach(() => {
  for (const each of owners.splice(0)) undoTimeline.forget(each);
  undoTimeline.block(undefined);
  report.mockReset();
});

describe('undo timeline', () => {
  it('runs back the latest step of whichever history made it', async () => {
    const log: string[] = [];
    const service = made('service', log);
    const media = made('media', log);
    undoTimeline.record(service);
    undoTimeline.record(media);
    undoTimeline.record(service);
    await undoTimeline.replay('undo', report);
    await undoTimeline.replay('undo', report);
    await undoTimeline.replay('undo', report);
    expect(log).toEqual(['service:undo', 'media:undo', 'service:undo']);
    expect(undoReason('undo')).toBe('되돌릴 편집이 없습니다.');
  });

  it('redoes in the opposite order and a new step drops what could be redone', async () => {
    const log: string[] = [];
    const service = made('service', log);
    const labels = made('labels', log);
    undoTimeline.record(service);
    undoTimeline.record(labels);
    await undoTimeline.replay('undo', report);
    await undoTimeline.replay('undo', report);
    await undoTimeline.replay('redo', report);
    expect(log.at(-1)).toBe('service:redo');
    undoTimeline.record(labels);
    expect(undoReason('redo')).toBe('다시 실행할 편집이 없습니다.');
    expect(undoTimeline.get().undo).toBe(2);
  });

  it('drops a step its history could not run, and forgets a closed history', async () => {
    const log: string[] = [];
    const broken = made('broken', log, false);
    const service = made('service', log);
    undoTimeline.record(service);
    undoTimeline.record(broken);
    expect(await undoTimeline.replay('undo', report)).toBe(false);
    expect(undoTimeline.get()).toEqual({undo: 1, redo: 0, busy: false});
    undoTimeline.forget(service);
    expect(undoReason('undo')).toBe('되돌릴 편집이 없습니다.');
  });

  it('runs one step at a time', async () => {
    let finish: (done: boolean) => void = () => undefined;
    const slow: UndoOwner = {
      replay: () =>
        new Promise<boolean>(resolve => {
          finish = resolve;
        }),
    };
    owners.push(slow);
    undoTimeline.record(slow);
    undoTimeline.record(slow);
    const first = undoTimeline.replay('undo', report);
    expect(await undoTimeline.replay('undo', report)).toBe(false);
    finish(true);
    expect(await first).toBe(true);
    expect(undoTimeline.get()).toEqual({undo: 1, redo: 1, busy: false});
  });

  it('runs nothing while it is blocked, and says why', async () => {
    const log: string[] = [];
    const service = made('service', log);
    undoTimeline.record(service);
    undoTimeline.block('진행에서는 실행 취소를 쓰지 않습니다.');
    expect(undoReason('undo')).toBe('진행에서는 실행 취소를 쓰지 않습니다.');
    expect(await undoTimeline.replay('undo', report)).toBe(false);
    expect(log).toEqual([]);
    undoTimeline.block(undefined);
    expect(await undoTimeline.replay('undo', report)).toBe(true);
    expect(log).toEqual(['service:undo']);
  });
});
