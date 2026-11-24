import {describe, expect, it} from 'vitest';
import {MEDIA_DELETE_HISTORY_LIMIT} from '@core/schema/media/mediaList';
import {MediaDeleteHistory} from '@renderer/features/media/mediaDeleteHistory';

describe('MediaDeleteHistory', () => {
  it('makes each written delete an undo step and drops the redo steps', () => {
    const history = new MediaDeleteHistory();
    expect(history.recordDelete(3)).toBe(true);
    expect(history.recordStep('undo', 4)).toBe(true);
    expect(history.can('redo')).toBe(true);
    expect(history.recordDelete(5)).toBe(true);
    expect(history.can('undo')).toBe(true);
    expect(history.can('redo')).toBe(false);
  });

  it('keeps at most the limit of undo steps', () => {
    const history = new MediaDeleteHistory();
    for (
      let revision = 1;
      revision <= MEDIA_DELETE_HISTORY_LIMIT + 5;
      revision++
    ) {
      history.recordDelete(revision);
    }
    let undone = 0;
    while (history.can('undo')) {
      history.recordStep('undo', 1000 + undone);
      undone += 1;
    }
    expect(undone).toBe(MEDIA_DELETE_HISTORY_LIMIT);
  });

  it('drops every step when a write lands on a list that moved on', () => {
    const history = new MediaDeleteHistory();
    history.recordDelete(3);
    expect(history.recordDelete(null)).toBe(false);
    expect(history.can('undo')).toBe(false);
    history.recordDelete(4);
    expect(history.recordStep('undo', null)).toBe(false);
    expect(history.can('redo')).toBe(false);
  });

  it('takes no step while one waits for main', () => {
    const history = new MediaDeleteHistory();
    history.recordDelete(3);
    history.begin();
    expect(history.busy).toBe(true);
    expect(history.can('undo')).toBe(false);
    history.end();
    expect(history.can('undo')).toBe(true);
  });

  it('ends the redo steps when the list changes elsewhere, but not while waiting', () => {
    const history = new MediaDeleteHistory();
    history.recordDelete(3);
    history.recordStep('undo', 4);
    history.begin();
    history.follow(9);
    history.end();
    expect(history.can('redo')).toBe(true);
    history.follow(4);
    expect(history.can('redo')).toBe(true);
    history.follow(5);
    expect(history.can('redo')).toBe(false);
  });
});
