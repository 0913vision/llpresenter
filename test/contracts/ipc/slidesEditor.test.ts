import {describe, expect, it} from 'vitest';
import {
  parseSlidesEditorSaved,
  parseSlidesEditorTarget,
} from '@contracts/ipc/slidesEditor';

const id = '00000000-0000-4000-8000-000000000001';
describe('slides editor IPC', () => {
  it('checks target ids and drops unknown target fields', () => {
    expect(
      parseSlidesEditorTarget({serviceId: id, itemId: id, extra: true}),
    ).toEqual({ok: true, value: {serviceId: id, itemId: id}});
    for (const invalid of [
      null,
      [],
      {},
      {serviceId: id},
      {serviceId: 'bad', itemId: id},
    ]) {
      expect(parseSlidesEditorTarget(invalid).ok).toBe(false);
    }
  });
  it('validates both sides of the history event through the capped service schema', () => {
    const service = {
      format: 'llservice',
      schemaVersion: 1,
      id,
      name: 'Service',
      date: '2026-11-05T11:00',
      order: [],
    };
    expect(parseSlidesEditorSaved({before: service, after: service}).ok).toBe(
      true,
    );
    expect(
      parseSlidesEditorSaved({
        before: service,
        after: {...service, order: Array.from({length: 1001}, () => ({id}))},
      }).ok,
    ).toBe(false);
    expect(parseSlidesEditorSaved({before: service, after: null}).ok).toBe(
      false,
    );
  });
});
