import {expect, it, onTestFinished, vi} from 'vitest';
import {parseScreenId} from '@shared/schema/ids';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
  type SettingsName,
} from '@shared/schema/settingsDocuments';
import {expectSuccess} from '@shared/schema/testHelpers';
import {referencedStageLayouts} from '@shared/stageLayoutReferences';
import type {DocumentFiles} from './contentPersistence';
import {SettingsStore} from './settingsStore';

const LOOK = '00000000-0000-4000-8000-000000000001';
const INACTIVE = '00000000-0000-4000-8000-000000000002';
const SCREEN = expectSuccess(
  parseScreenId('00000000-0000-4000-8000-000000000011'),
);
const OTHER_SCREEN = '00000000-0000-4000-8000-000000000012';
const USED = '00000000-0000-4000-8000-000000000021';
const FREE = '00000000-0000-4000-8000-000000000022';
const MISSING = '00000000-0000-4000-8000-000000000023';

function document(
  name: SettingsName,
  value: object,
  access: 'editable' | 'readOnly' = 'editable',
) {
  return expectSuccess(
    parseSettingsDocument({
      name,
      value: {schemaVersion: 1, ...value},
      revision: 1,
      access,
    }),
  );
}
function setup({
  reference = USED,
  inactive = false,
  omitLooks = false,
  omitStages = false,
  stageAccess = 'editable',
}: {
  reference?: string | null;
  inactive?: boolean;
  omitLooks?: boolean;
  omitStages?: boolean;
  stageAccess?: 'editable' | 'readOnly';
} = {}) {
  const documents = new Map<SettingsName, SettingsDocument>();
  const card = {
    layers: {slide: true},
    ...(reference === null ? {} : {stageLayout: reference}),
    future: 'card',
  };
  if (!omitLooks) {
    documents.set(
      'looks',
      document('looks', {
        format: 'llsettings.looks',
        current: LOOK,
        lyricStyles: [],
        future: 'looks',
        looks: [
          {
            id: LOOK,
            name: 'Current',
            screens: inactive ? {} : {[SCREEN]: card},
          },
          ...(inactive
            ? [
                {
                  id: INACTIVE,
                  name: 'Inactive',
                  screens: {[OTHER_SCREEN]: card},
                },
              ]
            : []),
        ],
      }),
    );
  }
  if (!omitStages) {
    documents.set(
      'stage-layouts',
      document(
        'stage-layouts',
        {
          format: 'llsettings.stage',
          future: 'stages',
          layouts: [USED, FREE].map((id, index) => ({
            id,
            name: index === 0 ? 'Used' : 'Free',
            width: 1920,
            height: 1080,
            elements: [],
            future: 'layout',
          })),
        },
        stageAccess,
      ),
    );
  }
  documents.set(
    'labels',
    document('labels', {format: 'llsettings.labels', labels: []}),
  );
  const write = vi
    .fn<DocumentFiles['write']>()
    .mockResolvedValue({ok: true, value: undefined});
  const store = new SettingsStore({
    documents,
    problems: [],
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      flush: async () => undefined,
    },
    saving: {
      folder: 'C:/data',
      delayMs: 0,
      files: {write, remove: async () => ({ok: true, value: undefined})},
    },
  });
  onTestFinished(() => store.dispose());
  return {store, write};
}
function change(store: SettingsStore, name: SettingsName, value: object) {
  return expectSuccess(
    parseSettingsEdit({
      type: 'settings.update',
      name,
      baseRevision: store.get(name).revision,
      value,
    }),
  );
}
function remove(store: SettingsStore, id: string) {
  const before = store.get('stage-layouts');
  if (before.name !== 'stage-layouts') throw new Error('Missing stages');
  return change(store, 'stage-layouts', {
    ...before.value,
    layouts: before.value.layouts.filter(layout => layout.id !== id),
  });
}
function assign(store: SettingsStore, id: string | null) {
  const before = store.get('looks');
  if (before.name !== 'looks') throw new Error('Missing Looks');
  const first = before.value.looks[0],
    card = first?.screens[SCREEN];
  if (first === undefined || card === undefined) {
    throw new Error('Missing card');
  }
  const updated: Record<string, unknown> = {...card};
  if (id === null) delete updated.stageLayout;
  else updated.stageLayout = id;
  return change(store, 'looks', {
    ...before.value,
    looks: [
      {...first, screens: {...first.screens, [SCREEN]: updated}},
      ...before.value.looks.slice(1),
    ],
  });
}

it.each([false, true])(
  'refuses removal used by a Look, including inactive=%s, without writes or notifications',
  async inactive => {
    const {store, write} = setup({inactive});
    const before = store.get('stage-layouts'),
      notify = vi.fn();
    store.subscribe(notify);
    const looks = store.get('looks');
    if (looks.name !== 'looks') throw new Error('Missing Looks');
    expect([...referencedStageLayouts(looks.value)]).toEqual([USED]);
    expect(await store.apply(remove(store, USED))).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    expect(store.get('stage-layouts')).toBe(before);
    expect(write).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  },
);

it('removes an unassigned layout and preserves the remaining document fields', async () => {
  const {store, write} = setup();
  const looks = store.get('looks');
  expect(await store.apply(remove(store, FREE))).toMatchObject({ok: true});
  expect(store.get('stage-layouts')).toMatchObject({
    revision: 2,
    value: {future: 'stages', layouts: [{id: USED, future: 'layout'}]},
  });
  expect(store.get('looks')).toBe(looks);
  expect(write).toHaveBeenCalledOnce();
});

it('checks the in-memory assignment even while its disk write is pending', async () => {
  const {store} = setup();
  const assignment = store.apply(assign(store, FREE));
  const removal = store.apply(remove(store, FREE));
  const [assigned, removed] = await Promise.all([assignment, removal]);
  expect(assigned.ok).toBe(true);
  expect(removed).toMatchObject({ok: false, error: {reason: 'invalid'}});
  expect(store.get('stage-layouts').revision).toBe(1);
});

it('rejects a new assignment after removal wins the ordering', async () => {
  const {store} = setup();
  const removal = store.apply(remove(store, FREE));
  const assignment = store.apply(assign(store, FREE));
  const [removed, assigned] = await Promise.all([removal, assignment]);
  expect(removed.ok).toBe(true);
  expect(assigned).toMatchObject({ok: false, error: {reason: 'invalid'}});
  expect(store.get('looks').revision).toBe(1);
});

it('allows clearing the reference before removing its layout', async () => {
  const {store} = setup();
  const cleared = store.apply(assign(store, null));
  const removed = store.apply(remove(store, USED));
  expect((await cleared).ok).toBe(true);
  expect((await removed).ok).toBe(true);
});

it('rejects a newly missing target without changing the stored Look', async () => {
  const {store, write} = setup();
  const before = store.get('looks');
  expect(await store.apply(assign(store, MISSING))).toMatchObject({
    ok: false,
    error: {reason: 'invalid'},
  });
  expect(store.get('looks')).toBe(before);
  expect(write).not.toHaveBeenCalled();
});

it('preserves existing missing targets during unrelated edits even if stage settings are unavailable', async () => {
  const {store} = setup({reference: MISSING, omitStages: true});
  const before = store.get('looks');
  if (before.name !== 'looks') throw new Error('Missing Looks');
  const edit = change(store, 'looks', {
    ...before.value,
    looks: before.value.looks.map(look => ({...look, name: 'Renamed'})),
  });
  expect((await store.apply(edit)).ok).toBe(true);
  expect(store.get('looks')).toMatchObject({
    value: {
      future: 'looks',
      looks: [
        {
          name: 'Renamed',
          screens: {[SCREEN]: {stageLayout: MISSING, future: 'card'}},
        },
      ],
    },
  });
});

it('allows referencing an existing read-only layout without editing its definitions', async () => {
  const {store} = setup({stageAccess: 'readOnly'});
  const stages = store.get('stage-layouts');
  expect((await store.apply(assign(store, FREE))).ok).toBe(true);
  expect(store.get('stage-layouts')).toBe(stages);
});

it.each(['screen', 'Look'])(
  'rejects copying an existing dangling assignment to a new %s',
  async target => {
    const {store, write} = setup({reference: MISSING});
    const before = store.get('looks');
    if (before.name !== 'looks') throw new Error('Missing Looks');
    const current = before.value.looks[0],
      card = current?.screens[SCREEN];
    if (current === undefined || card === undefined) {
      throw new Error('Missing card');
    }
    const copy =
      target === 'screen'
        ? [{...current, screens: {...current.screens, [OTHER_SCREEN]: card}}]
        : [...before.value.looks, {...current, id: INACTIVE, name: 'Copy'}];
    expect(
      await store.apply(change(store, 'looks', {...before.value, looks: copy})),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.get('looks')).toBe(before);
    expect(write).not.toHaveBeenCalled();
    expect(
      (
        await store.apply(
          change(store, 'looks', {
            ...before.value,
            looks: [{...current, name: 'Renamed'}],
          }),
        )
      ).ok,
    ).toBe(true);
  },
);

it('requires related settings only when a reference change needs them', async () => {
  const noLooks = setup({omitLooks: true});
  expect(await noLooks.store.apply(remove(noLooks.store, FREE))).toMatchObject({
    ok: false,
    error: {reason: 'not-found'},
  });
  const stages = noLooks.store.get('stage-layouts');
  if (stages.name !== 'stage-layouts') throw new Error('Missing stages');
  expect(
    (
      await noLooks.store.apply(
        change(noLooks.store, 'stage-layouts', {
          ...stages.value,
          layouts: stages.value.layouts.map(layout => ({
            ...layout,
            name: `${layout.name} renamed`,
          })),
        }),
      )
    ).ok,
  ).toBe(true);
  const noStages = setup({omitStages: true});
  expect(
    await noStages.store.apply(assign(noStages.store, FREE)),
  ).toMatchObject({ok: false, error: {reason: 'not-found'}});
  const unrelated = setup({omitLooks: true, omitStages: true});
  expect(
    (
      await unrelated.store.apply(
        change(unrelated.store, 'labels', {
          format: 'llsettings.labels',
          schemaVersion: 1,
          labels: [],
        }),
      )
    ).ok,
  ).toBe(true);
});
