import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {preserveUnknownFields} from '@core/schema/common/preserveUnknown';

const itemSchema = v.object({id: v.string(), name: v.string()});
const namedSchema = v.object({name: v.string(), size: v.number()});
const stepSchema = v.variant('kind', [
  v.object({kind: v.literal('show'), slide: v.string()}),
  v.object({kind: v.literal('wait'), seconds: v.number()}),
]);
const fileSchema = v.object({
  title: v.string(),
  note: v.optional(v.string()),
  items: v.array(itemSchema),
  named: v.array(namedSchema),
  steps: v.array(stepSchema),
  byScreen: v.record(v.string(), v.object({size: v.number()})),
});

describe('preserveUnknownFields', () => {
  it('keeps a field this version does not know, on the object and inside it', () => {
    const current = {
      title: 'old',
      future: 'kept',
      items: [],
      named: [],
      steps: [],
      byScreen: {main: {size: 1, futureSize: 'kept too'}},
    };
    const update = {
      title: 'new',
      items: [],
      named: [],
      steps: [],
      byScreen: {main: {size: 2}},
    };

    expect(preserveUnknownFields(fileSchema, current, update)).toEqual({
      title: 'new',
      future: 'kept',
      items: [],
      named: [],
      steps: [],
      byScreen: {main: {size: 2, futureSize: 'kept too'}},
    });
  });

  it('leaves a known field removed when the update drops it', () => {
    const base = {items: [], named: [], steps: [], byScreen: {}};

    expect(
      preserveUnknownFields(
        fileSchema,
        {...base, title: 'a', note: 'gone'},
        {...base, title: 'a'},
      ),
    ).toEqual({...base, title: 'a'});
  });

  it('follows items by id when they move, and leaves a deleted item deleted', () => {
    const base = {title: 't', named: [], steps: [], byScreen: {}};
    const current = {
      ...base,
      items: [
        {id: 'a', name: 'A', extra: 'of a'},
        {id: 'b', name: 'B', extra: 'of b'},
        {id: 'c', name: 'C', extra: 'of c'},
      ],
    };
    const update = {
      ...base,
      items: [
        {id: 'c', name: 'C'},
        {id: 'a', name: 'A2'},
      ],
    };

    expect(preserveUnknownFields(fileSchema, current, update)).toMatchObject({
      items: [
        {id: 'c', name: 'C', extra: 'of c'},
        {id: 'a', name: 'A2', extra: 'of a'},
      ],
    });
  });

  it('matches items without an id by name, else by place', () => {
    const base = {title: 't', items: [], steps: [], byScreen: {}};
    const current = {
      ...base,
      named: [
        {name: 'x', size: 1, extra: 'of x'},
        {name: 'y', size: 2, extra: 'of y'},
      ],
    };
    const update = {
      ...base,
      named: [
        {name: 'y', size: 3},
        {name: 'z', size: 4},
      ],
    };

    expect(preserveUnknownFields(fileSchema, current, update)).toMatchObject({
      named: [
        {name: 'y', size: 3, extra: 'of y'},
        {name: 'z', size: 4, extra: 'of y'},
      ],
    });
  });

  it('keeps the unknown fields of steps that have only a kind, kept in place', () => {
    const base = {title: 't', items: [], named: [], byScreen: {}};
    const current = {
      ...base,
      steps: [
        {kind: 'show', slide: 's1', extra: 'of s1'},
        {kind: 'wait', seconds: 2, extra: 'of wait'},
      ],
    };
    const update = {
      ...base,
      steps: [
        {kind: 'show', slide: 's2'},
        {kind: 'wait', seconds: 3},
      ],
    };

    expect(preserveUnknownFields(fileSchema, current, update)).toMatchObject({
      steps: [
        {kind: 'show', slide: 's2', extra: 'of s1'},
        {kind: 'wait', seconds: 3, extra: 'of wait'},
      ],
    });
  });
});
