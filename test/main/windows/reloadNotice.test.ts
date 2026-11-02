import {EventEmitter} from 'node:events';
import {expect, it, vi} from 'vitest';
import {announceReloadAfterCrash} from '@main/windows/reloadNotice';

function setup() {
  const contents = new EventEmitter();
  const announce = vi.fn();
  const stop = announceReloadAfterCrash(contents, announce);
  return {contents, announce, stop};
}

it('says nothing for the first load', () => {
  const {contents, announce} = setup();
  contents.emit('did-finish-load');
  expect(announce).not.toHaveBeenCalled();
});

it('says so once when the page loads again after the renderer died', () => {
  const {contents, announce} = setup();
  contents.emit('render-process-gone', {}, {reason: 'crashed'});
  expect(announce).not.toHaveBeenCalled();
  contents.emit('did-finish-load');
  contents.emit('did-finish-load');
  expect(announce).toHaveBeenCalledOnce();
});

it('says nothing after a clean exit, and nothing once stopped', () => {
  const {contents, announce, stop} = setup();
  contents.emit('render-process-gone', {}, {reason: 'clean-exit'});
  contents.emit('did-finish-load');
  stop();
  contents.emit('render-process-gone', {}, {reason: 'crashed'});
  contents.emit('did-finish-load');
  expect(announce).not.toHaveBeenCalled();
  expect(contents.listenerCount('did-finish-load')).toBe(0);
});
