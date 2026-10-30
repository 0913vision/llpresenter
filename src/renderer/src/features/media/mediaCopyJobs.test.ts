import {expect, it} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {MEDIA_LIMITS} from '@core/schema/mediaList';
import {updateActiveCopies, type CopyJob} from './mediaCopyJobs';

function queued(index: number): CopyJob {
  return {
    mediaId: createMediaId(
      `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ),
    fileName: `invented-${index}.mp4`,
    phase: 'queued',
    percent: 0,
  };
}

it('caps new jobs at the shared limit while known jobs can advance and free a slot', () => {
  const first = queued(1);
  const jobs = new Map(
    Array.from({length: MEDIA_LIMITS.items}, (_, index) => {
      const job = queued(index + 1);
      return [job.mediaId, job] as const;
    }),
  );
  const overflow = queued(MEDIA_LIMITS.items + 1);
  expect(updateActiveCopies(jobs, overflow)).toBe(false);
  expect(jobs.size).toBe(MEDIA_LIMITS.items);
  expect(jobs.has(overflow.mediaId)).toBe(false);
  expect(
    updateActiveCopies(jobs, {...first, phase: 'copying', percent: 50}),
  ).toBe(true);
  expect(jobs.get(first.mediaId)?.percent).toBe(50);
  expect(
    updateActiveCopies(jobs, {...first, phase: 'complete', percent: 100}),
  ).toBe(true);
  expect(updateActiveCopies(jobs, overflow)).toBe(true);
  expect(jobs.size).toBe(MEDIA_LIMITS.items);
});
