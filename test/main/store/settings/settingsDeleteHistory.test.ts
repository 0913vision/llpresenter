import {describe, expect, it} from 'vitest';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/app/settingsDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {
  removedSettingsObject,
  SettingsDeleteHistory,
} from '@main/store/settings/settingsDeleteHistory';

const MACRO_A = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const MACRO_B = '7a2d3b0f-5c8e-4d2b-8f3a-123456789abc';

function labels(...names: readonly string[]): SettingsDocument {
  return expectSuccess(
    parseSettingsDocument({
      name: 'labels',
      revision: 1,
      access: 'editable',
      value: {
        format: 'llsettings.labels',
        schemaVersion: 1,
        labels: names.map(name => ({name, color: '#5FB8C2'})),
      },
    }),
  );
}

interface MacroRow {
  readonly id: string;
  readonly actions: number;
}

function macros(...rows: readonly MacroRow[]): SettingsDocument {
  return expectSuccess(
    parseSettingsDocument({
      name: 'macros',
      revision: 1,
      access: 'editable',
      value: {
        format: 'llsettings.macros',
        schemaVersion: 1,
        macros: rows.map(({id, actions}) => ({
          id,
          name: id,
          icon: 'star',
          color: 'teal',
          actions: Array.from({length: actions}, () => ({kind: 'clearAll'})),
        })),
        collections: [],
      },
    }),
  );
}

describe('removedSettingsObject', () => {
  it('sees a macro that went, and one that lost an action', () => {
    const before = macros({id: MACRO_A, actions: 2}, {id: MACRO_B, actions: 1});
    expect(
      removedSettingsObject(before, macros({id: MACRO_A, actions: 2})),
    ).toBe(true);
    expect(
      removedSettingsObject(
        before,
        macros({id: MACRO_A, actions: 1}, {id: MACRO_B, actions: 1}),
      ),
    ).toBe(true);
    expect(
      removedSettingsObject(
        before,
        macros({id: MACRO_A, actions: 3}, {id: MACRO_B, actions: 1}),
      ),
    ).toBe(false);
  });

  it('takes a label rename for no deletion, and a shorter list for one', () => {
    expect(
      removedSettingsObject(labels('1절', '후렴'), labels('1절', '코러스')),
    ).toBe(false);
    expect(removedSettingsObject(labels('1절', '후렴'), labels('1절'))).toBe(
      true,
    );
  });

  it('compares only the same area', () => {
    expect(removedSettingsObject(labels('1절'), macros())).toBe(false);
  });
});

describe('SettingsDeleteHistory', () => {
  const step = {before: [labels('1절', '후렴')], after: [labels('1절')]};

  it('moves a replayed deletion to the other direction', () => {
    const history = new SettingsDeleteHistory();
    expect(history.latest('labels', 'undo')).toBeUndefined();
    history.record('labels', step);
    expect(history.latest('labels', 'undo')).toBe(step);
    history.replayed('labels', 'undo');
    expect(history.latest('labels', 'undo')).toBeUndefined();
    expect(history.latest('labels', 'redo')).toBe(step);
  });

  it('drops what was left to redo when a new deletion is recorded', () => {
    const history = new SettingsDeleteHistory();
    history.record('labels', step);
    history.replayed('labels', 'undo');
    history.record('labels', step);
    expect(history.latest('labels', 'redo')).toBeUndefined();
  });

  it('keeps the latest 100 deletions of an area', () => {
    const history = new SettingsDeleteHistory();
    for (let index = 0; index < 101; index += 1) history.record('labels', step);
    for (let index = 0; index < 100; index += 1) {
      history.replayed('labels', 'undo');
    }
    expect(history.latest('labels', 'undo')).toBeUndefined();
  });
});
