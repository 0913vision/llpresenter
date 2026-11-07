import {describe, expect, it, vi} from 'vitest';
import {
  fixtureItems,
  fixtureMacros,
  fixtureServiceId,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {itemEditFixture} from '@fixtures/renderer/features/service/items/itemEditTesting';
import {startMacroRequest} from '@renderer/features/service/items/itemPlaybackCommands';
describe('item edit queue', () => {
  it('reports main save refusals', async () => {
    const {api, queue, problem} = itemEditFixture();
    const target = {serviceId: fixtureServiceId, itemId: fixtureItems.plain};
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Disk full',
        applied: {id: fixtureServiceId, revision: 4},
        unchangedFiles: ['invented.llservice'],
      },
    });
    expect(
      await queue.submit(startMacroRequest(target, fixtureMacros.praise)),
    ).toBe(true);
    expect(problem.mock.calls.at(-1)?.[0]).toBe('예배 저장 실패');
  });

  it('runs item edits one after another without refusing the later ones', async () => {
    const {queue, edits, service} = itemEditFixture();

    const first = queue.submit(
      startMacroRequest(
        {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
        fixtureMacros.sermon,
      ),
    );
    const second = queue.submit(
      startMacroRequest(
        {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
        fixtureMacros.praise,
      ),
    );
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(queue.busy).toBe(false);
    expect(edits.filter(edit => edit.type === 'service.update')).toHaveLength(
      2,
    );
    expect(service().service.order[1]).toMatchObject({
      macro: fixtureMacros.praise,
    });
  });
});
