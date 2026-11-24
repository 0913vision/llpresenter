import {afterEach, describe, expect, it, vi} from 'vitest';
import {renameHistory} from '@renderer/platform/undo/renameHistory';
import {undoReason, undoTimeline} from '@renderer/platform/undo/undoTimeline';

const report = vi.fn();

function renamed(names: string[], works = true) {
  return (name: string): Promise<boolean> => {
    if (works) names.push(name);
    return Promise.resolve(works);
  };
}

afterEach(() => {
  renameHistory.forget();
  report.mockReset();
});

describe('rename history', () => {
  it('gives the name before on 실행 취소 and the new one again on 다시 실행', async () => {
    const names: string[] = [];
    renameHistory.record({
      before: '주일 예배',
      after: '2부',
      rename: renamed(names),
    });
    await undoTimeline.replay('undo', report);
    expect(names).toEqual(['주일 예배']);
    await undoTimeline.replay('redo', report);
    expect(names).toEqual(['주일 예배', '2부']);
    expect(report).not.toHaveBeenCalled();
  });

  it('records no step for an unchanged name', () => {
    renameHistory.record({before: '2부', after: '2부', rename: renamed([])});
    expect(undoReason('undo')).toBe('되돌릴 편집이 없습니다.');
  });

  it('tells the operator when the name could not be given back', async () => {
    renameHistory.record({
      before: '주일 예배',
      after: '2부',
      rename: renamed([], false),
    });
    await undoTimeline.replay('undo', report);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({title: '이름 바꾸기 실행 취소 실패'}),
    );
  });
});
