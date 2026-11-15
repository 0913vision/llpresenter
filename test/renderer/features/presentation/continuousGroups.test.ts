import {expect, it} from 'vitest';
import {continuousGroups} from '@renderer/features/presentation/ContinuousSlideGrid';
import {applyService, useShow} from '@renderer/session/show';
import {sampleService} from '@fixtures/renderer/session/sampleService';

it('keeps service order and counts slide numbers across items and headings', () => {
  applyService(sampleService);
  const groups = continuousGroups(useShow.getState());
  expect(groups.map(group => group.row.id)).toEqual(
    sampleService.rows.map(row => row.id),
  );
  let count = 0;
  for (const group of groups) {
    expect(group.offset).toBe(count);
    if (group.row.kind === 'header') expect(group.tiles).toHaveLength(0);
    count += group.tiles.length;
  }
  expect(count).toBeGreaterThan(0);
  applyService(null);
});
