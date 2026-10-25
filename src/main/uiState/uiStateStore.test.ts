import {describe, expect, it} from 'vitest';
import type {AppLayout} from '@shared/schema/appConfig';
import type {UiFields, UiStateFields} from '../store/appConfigFile';
import type {Logger} from '../log';
import {UiStateStore} from './uiStateStore';

interface Harness {
  readonly store: UiStateStore;
  readonly changes: UiFields[];
  readonly warnings: string[];
}

function createHarness(initial: UiFields = {}): Harness {
  let current = initial;
  const changes: UiFields[] = [];
  const warnings: string[] = [];
  const fields: UiStateFields = {
    read: () => current,
    change: next => {
      current = {...current, ...next};
      changes.push(next);
    },
  };
  const log: Logger = {
    info: () => undefined,
    warn: message => void warnings.push(message),
    error: () => undefined,
    flush: () => Promise.resolve(),
  };
  return {store: new UiStateStore({fields, log}), changes, warnings};
}

const layout: AppLayout = {
  normal: {left: 300, right: 500, columns: 5},
  wide: {left: 320, right: 560},
};

describe('UiStateStore state', () => {
  it('gives an empty state when there is no layout', () => {
    expect(createHarness().store.state).toEqual({});
  });

  it('gives the layout of the fields and nothing else of them', () => {
    const {store} = createHarness({layout, mediaStrip: true});
    expect(store.state).toEqual({layout});
  });
});

describe('UiStateStore setLayout', () => {
  it('hands the merged layout to the fields', () => {
    const {store, changes} = createHarness({layout});
    store.setLayout({sizeClass: 'normal', left: 260, right: 480});
    const merged = {...layout, normal: {left: 260, right: 480, columns: 5}};
    expect(changes).toEqual([{layout: merged}]);
    expect(store.state).toEqual({layout: merged});
  });

  it('merges the 슬라이드 size alone and keeps the widths', () => {
    const {store, changes} = createHarness({layout});
    store.setLayout({sizeClass: 'wide', thumbnailScalePercent: 140});
    expect(changes).toEqual([
      {
        layout: {
          ...layout,
          wide: {left: 320, right: 560, thumbnailScalePercent: 140},
        },
      },
    ]);
  });

  it('starts a layout when the fields have none', () => {
    const {store, changes} = createHarness();
    store.setLayout({sizeClass: 'narrow', thumbnailScalePercent: 60});
    expect(changes).toEqual([{layout: {narrow: {thumbnailScalePercent: 60}}}]);
  });

  it('changes only the layout, so the other UI fields stay as they are', () => {
    const {store, changes} = createHarness({layout, macroView: 'list'});
    store.setLayout({sizeClass: 'normal', thumbnailScalePercent: 200});
    expect(Object.keys(changes[0] ?? {})).toEqual(['layout']);
  });

  it('drops and logs a change that is malformed, out of range, or half a pair', () => {
    const {store, changes, warnings} = createHarness({layout});
    store.setLayout({sizeClass: 'normal', left: 100, right: 480});
    store.setLayout({sizeClass: 'normal', left: 300});
    store.setLayout({sizeClass: 'huge', thumbnailScalePercent: 100});
    store.setLayout({sizeClass: 'normal', thumbnailScalePercent: 201});
    store.setLayout('nope');
    expect(changes).toEqual([]);
    expect(warnings).toHaveLength(5);
  });

  it('still takes the old thumbnail columns while the contract carries them', () => {
    const {store, changes} = createHarness();
    store.setLayout({sizeClass: 'normal', columns: 3});
    expect(changes).toEqual([{layout: {normal: {columns: 3}}}]);
  });
});
