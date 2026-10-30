import {describe, expect, it} from 'vitest';
import {checkPart} from './fileFormat';
import type {FileCodec} from './testHelpers';
import {expectFailure, expectSuccess, testId} from './testHelpers';
import {serviceItemIdSchema} from './ids';
import {
  parseService,
  parseTemplate,
  serializeService,
  serializeTemplate,
  serviceSchema,
  templateSchema,
  type ServiceItem,
} from './service';

const FILE = 'invented.llservice';
const ID = '00000000-0000-4000-8000-000000000001';
const itemId = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const BASE = {
  format: 'llservice',
  schemaVersion: 1,
  id: ID,
  name: 'Invented service',
};
const LEGACY_ORDER: ReadonlyArray<Readonly<Record<string, unknown>>> = [
  {id: itemId(1), header: 'Before'},
  {
    id: itemId(2),
    slot: 'song',
    title: 'Offering',
    future: {flags: [true, null]},
    memo: 'Keep this memo',
  },
  {id: itemId(3), slot: 'bible', title: '', constructor: 'keep own field'},
  {id: itemId(4), slot: 'slides', title: 'Closing', extra: ['invented']},
];
const EXPECTED_ORDER: ReadonlyArray<Readonly<Record<string, unknown>>> = [
  {id: itemId(1), header: 'Before'},
  {
    id: itemId(2),
    header: 'Offering',
    future: {flags: [true, null]},
    memo: 'Keep this memo',
  },
  {id: itemId(3), header: '', constructor: 'keep own field'},
  {id: itemId(4), header: 'Closing', extra: ['invented']},
];

function legacyCases<T extends {readonly order: readonly ServiceItem[]}>(
  name: string,
  codec: FileCodec<T>,
  fields: {readonly date?: string; readonly time?: string},
) {
  describe(`${name} legacy slot normalization`, () => {
    const raw = {
      ...BASE,
      ...fields,
      order: LEGACY_ORDER,
      futureFile: {keep: true},
    };
    it('reads every old slot kind as an empty section in the same position', () => {
      const loaded = expectSuccess(codec.parse(JSON.stringify(raw), FILE));
      expect(loaded.data).toEqual({...raw, order: EXPECTED_ORDER});
      expect(loaded).toMatchObject({
        access: 'editable',
        sourceVersion: 1,
        dropped: [],
      });
      const written = expectSuccess(codec.serialize(loaded.data, FILE));
      expect(JSON.parse(written)).toEqual({...raw, order: EXPECTED_ORDER});
      expect(expectSuccess(codec.parse(written, FILE)).data).toEqual(
        loaded.data,
      );
      expect(raw.order).toEqual(LEGACY_ORDER);
    });

    it('normalizes legacy input at the serializer without mutating it', () => {
      const current = expectSuccess(
        codec.parse(JSON.stringify({...raw, order: []}), FILE),
      ).data;
      const slot = Object.freeze({
        id: testId(serviceItemIdSchema, itemId(9)),
        slot: 'song' as const,
        title: 'Old title',
        unknown: {keep: true},
      });
      const value = {...current, order: Object.freeze([slot])};
      const written = expectSuccess(codec.serialize(value, FILE));
      expect(JSON.parse(written)).toMatchObject({
        order: [{id: slot.id, header: 'Old title', unknown: {keep: true}}],
      });
      expect(written).not.toContain('"slot"');
      expect(written).not.toContain('"title"');
      expect(value.order[0]).toEqual(slot);
    });

    it('preserves read-only access and source version for a newer old file', () => {
      const loaded = expectSuccess(
        codec.parse(JSON.stringify({...raw, schemaVersion: 2}), FILE),
      );
      expect(loaded).toMatchObject({
        access: 'readOnly',
        sourceVersion: 2,
        data: {order: EXPECTED_ORDER},
      });
      expect(expectFailure(codec.serialize(loaded.data, FILE))).toMatchObject({
        kind: 'newer',
      });
    });

    it.each([
      {slot: 'song', title: 4},
      {slot: 'song'},
      {slot: 'unknown', title: 'Invalid kind'},
      {slot: 'song', title: 'Conflicting', header: 'Other'},
    ])('rejects malformed legacy input %j before normalization', slot => {
      expect(
        codec.parse(
          JSON.stringify({...raw, order: [{id: itemId(1), ...slot}]}),
          FILE,
        ).ok,
      ).toBe(false);
    });
  });
}

legacyCases(
  'service',
  {parse: parseService, serialize: serializeService},
  {date: '2026-10-26T11:00'},
);
legacyCases(
  'template',
  {parse: parseTemplate, serialize: serializeTemplate},
  {time: '11:00'},
);

it('uses the same normalization for validated service and template IPC data', () => {
  expect(
    expectSuccess(
      checkPart(serviceSchema, {
        ...BASE,
        date: '2026-10-26T11:00',
        order: LEGACY_ORDER,
      }),
    ).order,
  ).toEqual(EXPECTED_ORDER);
  expect(
    expectSuccess(checkPart(templateSchema, {...BASE, order: LEGACY_ORDER}))
      .order,
  ).toEqual(EXPECTED_ORDER);
});
