import {describe, expect, it} from 'vitest';
import type {AppLayout} from '@core/schema/appConfig';
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

  it('gives layout and media visibility without other UI fields', () => {
    const {store} = createHarness({layout, mediaStrip: true});
    expect(store.state).toEqual({layout, mediaStrip: true});
  });
});

describe('panel visibility state', () => {
  it('merges alternating media fields without replacing layout or strip choices', () => {
    const {store, changes, warnings} = createHarness({
      layout,
      mediaStrip: true,
      prepMedia: false,
      mediaBrowser: {columns: 2, view: 'grid'},
    });
    store.setMediaBrowser({view: 'list'});
    store.setPrepMedia({visible: true});
    store.setMediaBrowser({columns: 8});
    store.setMediaStrip({visible: false});
    store.setPrepMedia({visible: false});
    expect(store.state).toEqual({
      layout,
      mediaStrip: false,
      prepMedia: false,
      mediaBrowser: {columns: 8, view: 'list'},
    });
    expect(changes).toEqual([
      {mediaBrowser: {columns: 2, view: 'list'}},
      {prepMedia: true},
      {mediaBrowser: {columns: 8, view: 'list'}},
      {mediaStrip: false},
      {prepMedia: false},
    ]);
    expect(warnings).toEqual([]);
  });

  it('rejects invalid media changes without handing any fields to the writer', () => {
    const initial = {prepMedia: true, mediaBrowser: {columns: 4}};
    const {store, changes, warnings} = createHarness(initial);
    for (const value of [
      null,
      [],
      {},
      {columns: 9},
      {view: 'bad'},
      {columns: 3, view: 'bad'},
    ]) {
      store.setMediaBrowser(value);
    }
    for (const value of [null, {}, {visible: 'false'}]) {
      store.setPrepMedia(value);
    }
    expect(changes).toEqual([]);
    expect(warnings).toHaveLength(9);
    expect(store.state).toEqual(initial);
  });
  it('merges sidebar state alone without changing widths or other size classes', () => {
    const {store} = createHarness({layout});
    store.setLayout({sizeClass: 'normal', leftCollapsed: true});
    store.setLayout({sizeClass: 'normal', leftCollapsed: false});
    expect(store.state).toEqual({
      layout: {...layout, normal: {...layout.normal, leftCollapsed: false}},
    });
  });

  it('hands only the media boolean to the single writer, including false', () => {
    const {store, changes} = createHarness({
      layout,
      mediaStrip: true,
      macroView: 'list',
    });
    store.setMediaStrip({visible: false});
    expect(changes).toEqual([{mediaStrip: false}]);
    expect(store.state).toEqual({layout, mediaStrip: false});
  });

  it('drops malformed media messages without changing state', () => {
    const {store, changes, warnings} = createHarness({mediaStrip: true});
    for (const value of [null, [], {}, {visible: 'false'}, {visible: 0}]) {
      store.setMediaStrip(value);
    }
    expect(changes).toEqual([]);
    expect(warnings).toHaveLength(5);
    expect(store.state).toEqual({mediaStrip: true});
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

  it('drops and logs legacy column changes without changing the saved layout', () => {
    const {store, changes, warnings} = createHarness({layout});
    store.setLayout({sizeClass: 'normal', columns: 3});
    expect(changes).toEqual([]);
    expect(store.state).toEqual({layout});
    expect(warnings).toEqual(['dropped a malformed layout change']);
  });

  it('keeps saved legacy columns when a scale command also carries obsolete columns', () => {
    const {store, changes} = createHarness({layout});
    store.setLayout({
      sizeClass: 'normal',
      thumbnailScalePercent: 123,
      columns: 3,
    });
    expect(changes).toEqual([
      {
        layout: {
          ...layout,
          normal: {...layout.normal, thumbnailScalePercent: 123},
        },
      },
    ]);
  });
});
