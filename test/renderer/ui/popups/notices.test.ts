import {describe, expect, it} from 'vitest';
import {
  addNotice,
  closeRecord,
  MAX_NOTICE_RECORDS,
  MAX_NOTICES,
  noticeTime,
  recordNotice,
  removeNotice,
  type Notice,
  type NoticeRecord,
} from '@renderer/ui/popups/notices';

function notice(key: string, kind: Notice['kind'] = 'info'): Notice {
  return {key, kind, icon: 'monitor', title: key, time: '11:24'};
}

function keys(notices: readonly Notice[]): string[] {
  return notices.map(shown => shown.key);
}

describe('addNotice', () => {
  it('puts the newest card on top', () => {
    const stack = addNotice(addNotice([], notice('a')), notice('b'));
    expect(keys(stack)).toEqual(['b', 'a']);
  });

  it('replaces the card with the same cause instead of stacking another', () => {
    const lost = notice('screen:stage', 'warning');
    const back = {...notice('screen:stage'), title: '무대 모니터 다시 연결됨'};
    const stack = addNotice(addNotice([notice('x'), lost], notice('y')), back);
    expect(keys(stack)).toEqual(['screen:stage', 'y', 'x']);
    expect(stack[0]?.title).toBe('무대 모니터 다시 연결됨');
  });

  it('closes the oldest information card first beyond three cards', () => {
    let stack: readonly Notice[] = [];
    for (const shown of [
      notice('info-old'),
      notice('warn-1', 'warning'),
      notice('info-new'),
      notice('warn-2', 'warning'),
    ]) {
      stack = addNotice(stack, shown);
    }
    expect(stack).toHaveLength(MAX_NOTICES);
    expect(keys(stack)).toEqual(['warn-2', 'info-new', 'warn-1']);
  });

  it('closes the oldest card when every card is a warning', () => {
    let stack: readonly Notice[] = [];
    for (const key of ['w1', 'w2', 'w3', 'w4']) {
      stack = addNotice(stack, notice(key, 'warning'));
    }
    expect(keys(stack)).toEqual(['w4', 'w3', 'w2']);
  });
});

describe('removeNotice', () => {
  it('takes only the card with that cause off', () => {
    const stack = addNotice(addNotice([], notice('a')), notice('b'));
    expect(keys(removeNotice(stack, 'a'))).toEqual(['b']);
  });
});

describe('noticeTime', () => {
  it('writes the local time in 24 hours without seconds', () => {
    expect(noticeTime(new Date(2026, 9, 26, 7, 5, 59))).toBe('07:05');
    expect(noticeTime(new Date(2026, 9, 26, 23, 41, 0))).toBe('23:41');
  });
});

describe('recordNotice', () => {
  function titles(records: readonly NoticeRecord[]): string[] {
    return records.map(record => record.title);
  }

  it('keeps every notice, newest first', () => {
    const records = recordNotice(
      recordNotice([], notice('a'), 1),
      notice('b'),
      2,
    );
    expect(titles(records)).toEqual(['b', 'a']);
  });

  it('rewrites the record of a card still open with the same cause and kind', () => {
    const counting = (title: string): Notice => ({...notice('import'), title});
    let records = recordNotice([], counting('가져오는 중 (1 / 3)'), 1);
    records = recordNotice(records, notice('other'), 2);
    records = recordNotice(records, counting('가져오는 중 (2 / 3)'), 3);
    expect(titles(records)).toEqual(['가져오는 중 (2 / 3)', 'other']);
  });

  it('adds a record when the kind changes or the card was closed', () => {
    const lost = {...notice('screen:stage', 'warning'), title: '끊김'};
    const back = {...notice('screen:stage'), title: '다시 연결됨'};
    let records = recordNotice([], lost, 1);
    records = recordNotice(records, back, 2);
    expect(titles(records)).toEqual(['다시 연결됨', '끊김']);
    records = closeRecord(records, 'screen:stage');
    records = recordNotice(records, back, 3);
    expect(titles(records)).toEqual(['다시 연결됨', '다시 연결됨', '끊김']);
  });

  it('keeps at most the newest hundred', () => {
    let records: readonly NoticeRecord[] = [];
    for (let id = 1; id <= MAX_NOTICE_RECORDS + 5; id++) {
      records = closeRecord(recordNotice(records, notice('n'), id), 'n');
    }
    expect(records).toHaveLength(MAX_NOTICE_RECORDS);
    expect(records[0]?.id).toBe(MAX_NOTICE_RECORDS + 5);
  });
});
