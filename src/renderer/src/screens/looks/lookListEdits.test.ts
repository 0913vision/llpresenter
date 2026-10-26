import {describe, expect, it} from 'vitest';
import {parseLookId, type LookId} from '@shared/schema/ids';
import type {LooksFile} from '@shared/schema/looks';
import {
  LOOK_ID,
  SERMON_LOOK_ID,
  looksDocument,
  settingsDocument,
} from '../testing/documents';
import {
  editLookList,
  LOOK_LIST_LIMIT,
  type LookListContext,
  type LookListEdit,
} from './lookListEdits';

function id(value: string): LookId {
  const parsed = parseLookId(value);
  if (!parsed.ok) throw new Error('Invalid fixture Look id');
  return parsed.value;
}

const current = id(LOOK_ID);
const sermon = id(SERMON_LOOK_ID);
const added = id('00000000-0000-4000-8000-0000000000a3');
const another = id('00000000-0000-4000-8000-0000000000a4');

function looks(): LooksFile {
  const document = looksDocument();
  if (document.name !== 'looks') throw new Error('Expected looks');
  return document.value;
}

const context: LookListContext = {current, macros: []};

function apply(
  edit: LookListEdit,
  file = looks(),
  active = context,
): LooksFile {
  const result = editLookList(file, edit, active);
  if (!result.ok) throw new Error(result.error.reason);
  return result.value;
}

describe('Look lifecycle edits', () => {
  it('adds a copy of the live Look with a unique default name', () => {
    const before = {...looks(), future: {kept: true}};
    const next = apply({kind: 'add', id: added}, before, {
      current: sermon,
      macros: [],
    });
    expect(next.looks.at(-1)).toMatchObject({
      id: added,
      name: '새 Look',
      screens: before.looks[1]?.screens,
    });
    expect(next.current).toBe(before.current);
    expect(next.lyricStyles).toBe(before.lyricStyles);
    expect(next).toHaveProperty('future', {kept: true});
    expect(before.looks).toHaveLength(2);
    const again = apply({kind: 'add', id: another}, next);
    expect(again.looks.at(-1)?.name).toBe('새 Look 2');
  });

  it('duplicates the selected Look without changing the current Look', () => {
    const next = apply({kind: 'duplicate', id: added, source: sermon});
    expect(next.looks.at(-1)).toMatchObject({
      name: '설교 복사본',
      screens: next.looks[1]?.screens,
    });
    expect(next.current).toBe(current);
    const again = apply({kind: 'duplicate', id: another, source: sermon}, next);
    expect(again.looks.at(-1)?.name).toBe('설교 복사본 2');
  });

  it('trims a valid rename and preserves the other Look', () => {
    const before = looks();
    const next = apply({kind: 'rename', id: sermon, name: ' 새 이름 '}, before);
    expect(next.looks[1]?.name).toBe('새 이름');
    expect(next.looks[0]).toBe(before.looks[0]);
  });

  it('normalizes a padded candidate before generating duplicate suffixes', () => {
    const before = looks();
    const padded = {
      ...before,
      looks: before.looks.map(look =>
        look.id === sermon ? {...look, name: '  설교'} : look,
      ),
    };
    const first = apply({kind: 'duplicate', id: added, source: sermon}, padded);
    const second = apply(
      {kind: 'duplicate', id: another, source: sermon},
      first,
    );
    expect(first.looks.at(-1)?.name).toBe('설교 복사본');
    expect(second.looks.at(-1)?.name).toBe('설교 복사본 2');
  });

  it.each([
    {name: '', reason: 'empty'},
    {name: '   ', reason: 'empty'},
    {name: ' 평상시 ', reason: 'taken'},
  ])('rejects rename $name with $reason', ({name, reason}) => {
    expect(
      editLookList(looks(), {kind: 'rename', id: sermon, name}, context),
    ).toEqual({ok: false, error: {reason}});
  });

  it('rejects missing Look targets and duplicate ids', () => {
    for (const edit of [
      {kind: 'duplicate', id: another, source: added},
      {kind: 'rename', id: added, name: '새 이름'},
      {kind: 'delete', id: added},
    ] satisfies LookListEdit[]) {
      expect(editLookList(looks(), edit, context)).toEqual({
        ok: false,
        error: {reason: 'missing'},
      });
    }
    expect(editLookList(looks(), {kind: 'add', id: current}, context)).toEqual({
      ok: false,
      error: {reason: 'duplicate-id'},
    });
  });

  it('keeps both the saved current Look and the live current Look protected', () => {
    for (const target of [current, sermon]) {
      expect(
        editLookList(
          looks(),
          {kind: 'delete', id: target, confirmed: true},
          {current: sermon, macros: []},
        ),
      ).toEqual({ok: false, error: {reason: 'current'}});
    }
  });

  it('requires confirmation for a Look referenced by a macro', () => {
    const document = settingsDocument('macros', {
      collections: [],
      macros: [
        {
          id: '00000000-0000-4000-8000-0000000000c1',
          name: '전환',
          icon: 'macro',
          color: 'teal',
          actions: [{kind: 'look', look: sermon}],
        },
      ],
    });
    if (document.name !== 'macros') throw new Error('Expected macros');
    const active = {current, macros: document.value.macros};
    expect(editLookList(looks(), {kind: 'delete', id: sermon}, active)).toEqual(
      {ok: false, error: {reason: 'confirmation-required', macros: ['전환']}},
    );
    expect(
      apply(
        {kind: 'delete', id: sermon, confirmed: true},
        looks(),
        active,
      ).looks.map(look => look.id),
    ).toEqual([current]);
  });

  it('bounds creation while allowing existing entries to be renamed', () => {
    const before = looks();
    const source = before.looks[0];
    if (source === undefined) throw new Error('Missing fixture Look');
    const full = {
      ...before,
      looks: Array.from({length: LOOK_LIST_LIMIT}, (_, index) => ({
        ...source,
        id: id(
          `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
        ),
        name: `Look ${index}`,
      })),
    };
    expect(editLookList(full, {kind: 'add', id: added}, context)).toEqual({
      ok: false,
      error: {reason: 'full'},
    });
    expect(
      apply(
        {kind: 'rename', id: full.looks[0]?.id ?? current, name: '새 이름'},
        full,
      ).looks[0]?.name,
    ).toBe('새 이름');
  });
});
