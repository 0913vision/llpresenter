import {describe, expect, it} from 'vitest';
import type {AppLayout} from '@core/schema/appConfig';
import type {UiFields, UiStateFields} from '@main/store/appConfigFile';
import {UiStateStore} from '@main/uiState/uiStateStore';
import {createScreenId, macroCollectionIdSchema} from '@core/schema/ids';
import {testId} from '@fixtures/core/schema/testHelpers';

interface Harness {
  readonly store: UiStateStore;
  readonly changes: UiFields[];
}

function createHarness(initial: UiFields = {}): Harness {
  let current = initial;
  const changes: UiFields[] = [];
  const fields: UiStateFields = {
    read: () => current,
    change: next => {
      current = {...current, ...next};
      changes.push(next);
    },
  };
  return {store: new UiStateStore(fields), changes};
}

const layout: AppLayout = {
  normal: {left: 300, right: 500},
  wide: {left: 320, right: 560},
};

describe('UiStateStore state', () => {
  it('keeps remembered screen, macro and tool choices', () => {
    const {store, changes} = createHarness();
    const screen = createScreenId('00000000-0000-4000-8000-000000000001');
    const collection = testId(
      macroCollectionIdSchema,
      '00000000-0000-4000-8000-000000000002',
    );
    store.setRememberedView({previewBig: screen});
    store.setRememberedView({previewBigVisible: false});
    store.setRememberedView({macroView: 'list', macroCollection: collection});
    store.setRememberedView({showToolTab: 'timer'});
    expect(store.state).toMatchObject({
      previewBig: screen,
      previewBigVisible: false,
      macroView: 'list',
      macroCollection: collection,
      showToolTab: 'timer',
    });
    store.setRememberedView({macroCollection: null});
    expect(changes.at(-1)).toEqual({macroCollection: undefined});
  });
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
    const {store, changes} = createHarness({
      layout,
      mediaStrip: true,
      mediaBrowser: {columns: 2, view: 'grid'},
    });
    store.setMediaBrowser({view: 'list'});
    store.setMediaBrowser({columns: 8});
    store.setMediaStrip({visible: false});
    expect(store.state).toEqual({
      layout,
      mediaStrip: false,
      mediaBrowser: {columns: 8, view: 'list'},
    });
    expect(changes).toEqual([
      {mediaBrowser: {columns: 2, view: 'list'}},
      {mediaBrowser: {columns: 8, view: 'list'}},
      {mediaStrip: false},
    ]);
  });

  it('hands only the media boolean to the single writer, including false', () => {
    const {store, changes} = createHarness({
      layout,
      mediaStrip: true,
      macroView: 'list',
    });
    store.setMediaStrip({visible: false});
    expect(changes).toEqual([{mediaStrip: false}]);
    expect(store.state).toEqual({layout, mediaStrip: false, macroView: 'list'});
  });
});

describe('UiStateStore setLayout', () => {
  it('hands the merged layout to the fields', () => {
    const {store, changes} = createHarness({layout});
    store.setLayout({sizeClass: 'normal', left: 260, right: 480});
    const merged = {...layout, normal: {left: 260, right: 480}};
    expect(changes).toEqual([{layout: merged}]);
    expect(store.state).toEqual({layout: merged});
  });

  it('changes only the layout, so the other UI fields stay as they are', () => {
    const {store, changes} = createHarness({layout, macroView: 'list'});
    store.setLayout({sizeClass: 'normal', thumbnailScalePercent: 200});
    expect(Object.keys(changes[0] ?? {})).toEqual(['layout']);
  });
});
