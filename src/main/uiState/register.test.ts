import {afterEach, describe, expect, it, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import type {UiFields, UiStateFields} from '../store/appConfigFile';
import type {Logger} from '../log';

type Handler = (event: unknown, value?: unknown) => unknown;

const handlers = vi.hoisted(() => ({
  handle: new Map<string, Handler>(),
  on: new Map<string, Handler>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.handle.set(channel, handler),
    on: (channel: string, handler: Handler) =>
      handlers.on.set(channel, handler),
    removeHandler: (channel: string) => handlers.handle.delete(channel),
    removeAllListeners: (channel: string) => handlers.on.delete(channel),
  },
}));

const {registerUiState} = await import('./register');

const log: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  flush: () => Promise.resolve(),
};

function fieldsOf(initial: UiFields): {
  readonly fields: UiStateFields;
  readonly changes: UiFields[];
} {
  let current = initial;
  const changes: UiFields[] = [];
  return {
    fields: {
      read: () => current,
      change: next => {
        current = {...current, ...next};
        changes.push(next);
      },
    },
    changes,
  };
}

afterEach(() => {
  handlers.handle.clear();
  handlers.on.clear();
});

describe('registerUiState', () => {
  it('answers ui:get with the layout of the fields', () => {
    const layout = {wide: {left: 320, right: 560}};
    registerUiState(fieldsOf({layout}).fields, log);
    expect(handlers.handle.get(Channels.uiGet)?.({})).toEqual({layout});
  });

  it('answers ui:get with an empty state when the fields have no layout', () => {
    registerUiState(fieldsOf({}).fields, log);
    expect(handlers.handle.get(Channels.uiGet)?.({})).toEqual({});
  });

  it('hands a layout change to the fields, and ui:get then shows it', () => {
    const {fields, changes} = fieldsOf({});
    registerUiState(fields, log);
    handlers.on.get(Channels.uiLayoutSet)?.(
      {},
      {sizeClass: 'normal', left: 260, right: 480},
    );
    expect(changes).toEqual([{layout: {normal: {left: 260, right: 480}}}]);
    expect(handlers.handle.get(Channels.uiGet)?.({})).toEqual({
      layout: {normal: {left: 260, right: 480}},
    });
  });

  it('removes its channels when it is disposed', () => {
    const registration = registerUiState(fieldsOf({}).fields, log);
    registration.dispose();
    expect(handlers.handle.has(Channels.uiGet)).toBe(false);
    expect(handlers.on.has(Channels.uiLayoutSet)).toBe(false);
    expect(handlers.on.has(Channels.uiMediaStripSet)).toBe(false);
    expect(handlers.on.has(Channels.uiPrepMediaSet)).toBe(false);
    expect(handlers.on.has(Channels.uiMediaBrowserSet)).toBe(false);
  });

  it('saves media and sidebar state through the shared fields', () => {
    const {fields, changes} = fieldsOf({});
    registerUiState(fields, log);
    handlers.on.get(Channels.uiMediaStripSet)?.({}, {visible: false});
    handlers.on.get(Channels.uiLayoutSet)?.(
      {},
      {sizeClass: 'narrow', leftCollapsed: true},
    );
    expect(changes).toEqual([
      {mediaStrip: false},
      {layout: {narrow: {leftCollapsed: true}}},
    ]);
    expect(handlers.handle.get(Channels.uiGet)?.({})).toEqual({
      mediaStrip: false,
      layout: {narrow: {leftCollapsed: true}},
    });
  });

  it('routes validated browser patches and the prep choice into shared fields', () => {
    const {fields, changes} = fieldsOf({mediaStrip: true});
    registerUiState(fields, log);
    handlers.on.get(Channels.uiMediaBrowserSet)?.({}, {columns: 6});
    handlers.on.get(Channels.uiMediaBrowserSet)?.({}, {view: 'list'});
    handlers.on.get(Channels.uiPrepMediaSet)?.({}, {visible: false});
    handlers.on.get(Channels.uiMediaBrowserSet)?.({}, {columns: 99});
    expect(changes).toEqual([
      {mediaBrowser: {columns: 6}},
      {mediaBrowser: {columns: 6, view: 'list'}},
      {prepMedia: false},
    ]);
    expect(handlers.handle.get(Channels.uiGet)?.({})).toEqual({
      mediaStrip: true,
      prepMedia: false,
      mediaBrowser: {columns: 6, view: 'list'},
    });
  });
});
