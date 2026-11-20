import {expect, it} from 'vitest';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {broadcastLookLayout} from '@core/themes/broadcastLook';
import {
  SERMON_TITLE_THEME_ID,
  sermonTitleBroadcastLayout,
} from '@core/themes/sundayScripture';
import {positionSermonBroadcast} from '@renderer/rendering/sermonBroadcastSpacing';
import type {RenderFrame} from '@renderer/rendering/layer';

it.each([1, 2])(
  'keeps measured ink 20px apart with 40px band padding for %i title lines',
  lines => {
    const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
    const layout = sermonTitleBroadcastLayout();
    const frame: RenderFrame = {
      screen: {id, kind: 'broadcast'},
      theme: {
        themeId: SERMON_TITLE_THEME_ID,
        revision: 1,
        missing: [],
        item: null,
        sourceScreenId: id,
        layout,
        emptyColor: '#000000',
      },
    };
    const views = layout.elements.map(element => {
      let y = element.frame.y;
      let height = element.frame.h;
      return {
        element,
        setY(value: number) {
          y = value;
        },
        setHeight(value: number) {
          height = value;
        },
        textBounds(ink?: boolean) {
          if (!ink) return undefined;
          const shift = y - element.frame.y;
          if (element.kind === 'itemName') {
            return {top: 784 + shift, bottom: 817 + shift};
          }
          if (element.kind === 'currentText') {
            return lines === 1
              ? {top: 872 + shift, bottom: 932 + shift}
              : {top: 833 + shift, bottom: 970 + shift};
          }
          return undefined;
        },
        get top() {
          return y;
        },
        get bottom() {
          return y + height;
        },
      };
    });
    positionSermonBroadcast(views, frame);
    positionSermonBroadcast(views, frame);
    const band = views.find(view => view.element.kind === 'box');
    const reference = views
      .find(view => view.element.kind === 'itemName')
      ?.textBounds(true);
    const title = views
      .find(view => view.element.kind === 'currentText')
      ?.textBounds(true);
    if (!band || !reference || !title) throw Error('Missing title views');
    expect(reference.top - band.top).toBe(40);
    expect(title.top - reference.bottom).toBe(20);
    expect(band.bottom - title.bottom).toBe(40);
    expect(band.bottom).toBe(990);
  },
);

it('does not reposition a custom broadcast title layout', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
  const layout = sermonTitleBroadcastLayout();
  const custom = {...layout, elements: layout.elements.slice(1)};
  const frame: RenderFrame = {
    screen: {id, kind: 'broadcast'},
    theme: {
      themeId: SERMON_TITLE_THEME_ID,
      revision: 1,
      missing: [],
      item: null,
      sourceScreenId: id,
      layout: custom,
      emptyColor: '#000000',
    },
  };
  const views = custom.elements.map(element => ({
    element,
    textBounds: () => ({top: 100, bottom: 200}),
    setY: () => {
      throw Error('Custom geometry must be retained');
    },
    setHeight: () => {
      throw Error('Custom geometry must be retained');
    },
  }));
  expect(() => positionSermonBroadcast(views, frame)).not.toThrow();
});

it('leaves the broadcast Bible layout unchanged', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
  const layout = broadcastLookLayout('plain');
  const frame: RenderFrame = {
    screen: {id, kind: 'broadcast'},
    theme: {
      themeId: createThemeId('00000000-0000-4000-8000-000000000102'),
      revision: 1,
      missing: [],
      item: null,
      sourceScreenId: id,
      layout,
      emptyColor: '#000000',
    },
  };
  const views = layout.elements.map(element => ({
    element,
    textBounds: () => ({top: 100, bottom: 200}),
    setY: () => {
      throw Error('Bible geometry must be retained');
    },
    setHeight: () => {
      throw Error('Bible geometry must be retained');
    },
  }));
  expect(() => positionSermonBroadcast(views, frame)).not.toThrow();
});
