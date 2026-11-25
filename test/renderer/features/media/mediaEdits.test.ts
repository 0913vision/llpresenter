import {expect, it} from 'vitest';
import {
  createdId,
  rejected,
  UnsavedPlaylistName,
  written,
  type MediaEditOutcome,
} from '@renderer/features/media/mediaEdits';

const saved: MediaEditOutcome = {ok: true, value: {id: 'm2', revision: 4}};
const unsaved: MediaEditOutcome = {
  ok: false,
  error: {
    reason: 'write-failed',
    message: 'disk',
    applied: {id: 'm3', revision: 5},
    unchangedFiles: ['media.json'],
  },
};
const refused = rejected(new Error('bad reply'));

it('counts a write as taken also when its file could not be saved', () => {
  expect(written(saved)).toBe(true);
  expect(written(unsaved)).toBe(true);
  expect(written(refused)).toBe(false);
});

it('reads the id a create made, also from a write whose file was not saved', () => {
  expect(createdId(saved)).toBe('m2');
  expect(createdId(unsaved)).toBe('m3');
  expect(createdId(refused)).toBeNull();
});

it('reads a failed call as a refusal with its message', () => {
  expect(refused).toEqual({
    ok: false,
    error: {reason: 'invalid', message: 'bad reply'},
  });
});

it('remembers a playlist name main took but could not save until a later rename is saved', () => {
  const name = new UnsavedPlaylistName();
  expect(name.follow(saved, 3)).toBe(true);
  expect(name.pending).toBe(false);

  expect(name.follow(unsaved, 3)).toBe(true);
  expect(name.pending).toBe(true);
  expect(name.follow({ok: true, value: null}, 5)).toBe(false);
  expect(name.follow({ok: true, value: {id: 'p', revision: 4}}, 4)).toBe(true);
  expect(name.pending).toBe(true);
  expect(name.follow({ok: true, value: {id: 'p', revision: 6}}, 5)).toBe(true);
  expect(name.pending).toBe(false);
  expect(name.follow({ok: true, value: null}, 6)).toBe(true);
});

it('remembers the revision a refused rename was asked on', () => {
  const name = new UnsavedPlaylistName();
  name.follow(refused, 7);
  expect(name.pending).toBe(true);
  name.follow({ok: true, value: {id: 'p', revision: 7}}, 7);
  expect(name.pending).toBe(false);
});
