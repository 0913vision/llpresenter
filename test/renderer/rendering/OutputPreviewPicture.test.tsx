import {render, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {OutputPreviewPicture} from '@renderer/rendering/OutputPreviewPicture';

function props(line: string) {
  const screenId = createScreenId('00000000-0000-4000-8000-000000000001');
  return {
    layers: {
      ...emptyLayers(),
      slide: {itemId: 'one', position: 0, label: null, lines: [line]},
    },
    appearance: {
      screen: {id: screenId, kind: 'audience' as const},
      theme: {
        themeId: createThemeId('00000000-0000-4000-8000-000000000002'),
        revision: 1,
        missing: [],
        sourceScreenId: screenId,
        layout: {mode: {kind: 'own' as const}, elements: []},
        emptyColor: '#000000',
        item: null,
      },
      background: '#000000',
      checker: false,
    },
  };
}

it('shares one decoded source between views and holds it until an edit is decoded', async () => {
  let finishEdit = (): void => undefined;
  const edited = new Promise<void>(resolve => {
    finishEdit = resolve;
  });
  const decode = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockReturnValueOnce(edited)
    .mockRejectedValueOnce(new Error('Decode failure'))
    .mockResolvedValue(undefined);
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode = decode;
    },
  );
  const createUrl = vi
    .fn()
    .mockReturnValueOnce('blob:original')
    .mockReturnValueOnce('blob:edit')
    .mockReturnValueOnce('blob:corrupt')
    .mockReturnValueOnce('blob:recovered');
  const createObjectURL = Object.getOwnPropertyDescriptor(
    URL,
    'createObjectURL',
  );
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createUrl,
  });
  const paint = vi.fn().mockResolvedValue(new Uint8Array([0xff, 0xd8]));
  const revoke = vi.fn();
  const revokeObjectURL = Object.getOwnPropertyDescriptor(
    URL,
    'revokeObjectURL',
  );
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revoke,
  });
  vi.stubGlobal('llp', {
    picture: {paint},
    fonts: {
      subscribe: vi.fn(),
      snapshot: vi.fn().mockResolvedValue({verified: true, families: []}),
    },
    media: {
      subscribe: vi.fn(),
      get: vi.fn().mockResolvedValue({revision: 0, value: {items: []}}),
    },
  });
  try {
    const views = (line: string) => (
      <>
        <OutputPreviewPicture {...props(line)} />
        <OutputPreviewPicture {...props(line)} />
      </>
    );
    const view = render(views('original'));
    const sources = () =>
      Array.from(view.container.querySelectorAll('img'), image => image.src);
    await waitFor(() =>
      expect(sources()).toEqual(['blob:original', 'blob:original']),
    );
    expect(paint).toHaveBeenCalledOnce();
    view.rerender(views('edit'));
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
    expect(sources()).toEqual(['blob:original', 'blob:original']);
    finishEdit();
    await waitFor(() => expect(sources()).toEqual(['blob:edit', 'blob:edit']));
    expect(paint).toHaveBeenCalledTimes(2);
    view.unmount();
    const reopened = render(views('edit'));
    expect(reopened.container.querySelector('img')?.src).toBe('blob:edit');
    expect(paint).toHaveBeenCalledTimes(2);

    paint.mockRejectedValueOnce(new Error('Painter timeout'));
    reopened.rerender(views('retry'));
    await waitFor(() => expect(paint).toHaveBeenCalledTimes(3));
    expect(
      reopened.container
        .querySelector('[data-preview-ready="false"] img')
        ?.getAttribute('src'),
    ).toBe('blob:edit');
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:corrupt'));
    expect(
      reopened.container
        .querySelector('[data-preview-ready="false"] img')
        ?.getAttribute('src'),
    ).toBe('blob:edit');
    await waitFor(() =>
      expect(
        reopened.container
          .querySelector('[data-preview-ready="true"] img')
          ?.getAttribute('src'),
      ).toBe('blob:recovered'),
    );
    expect(paint).toHaveBeenCalledTimes(5);
    expect(paint.mock.lastCall?.[0]).toMatchObject({repaint: true});
  } finally {
    vi.unstubAllGlobals();
    if (createObjectURL === undefined) {
      Reflect.deleteProperty(URL, 'createObjectURL');
    } else {
      Object.defineProperty(URL, 'createObjectURL', createObjectURL);
    }
    if (revokeObjectURL === undefined) {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    } else {
      Object.defineProperty(URL, 'revokeObjectURL', revokeObjectURL);
    }
  }
});
