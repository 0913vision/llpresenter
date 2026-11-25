import {expect, it} from 'vitest';
import {contentsForLog, pageForLog} from '@main/base/renderers/pageUrl';

it('names a window by its id and page', () => {
  expect(
    contentsForLog({
      id: 4,
      getURL: () => 'file:///index.html',
      isDestroyed: () => false,
    }),
  ).toEqual({id: 4, url: 'file:///index.html'});
});

it('never throws: a closed window, or one whose page cannot be read, gives what is known', () => {
  expect(
    contentsForLog({
      id: 5,
      isDestroyed: () => true,
      getURL: () => {
        throw new Error('Object has been destroyed');
      },
    }),
  ).toEqual({id: 5, url: null});
  expect(
    contentsForLog({
      getURL: () => {
        throw new Error('Object has been destroyed');
      },
    }),
  ).toEqual({id: null, url: null});
  expect(contentsForLog({})).toEqual({id: null, url: null});
});

it('names the page of a window by its file and query, or by its id', () => {
  expect(
    pageForLog({
      id: 3,
      getURL: () => 'file:///C:/app/out/renderer/output.html?screen=a1&ndi=1',
    }),
  ).toBe('output?screen=a1&ndi=1');
  expect(
    pageForLog({id: 4, getURL: () => 'http://localhost:5173/index.html'}),
  ).toBe('index');
  expect(pageForLog({id: 5, getURL: () => ''})).toBe('#5');
  expect(pageForLog({})).toBe('#?');
});
