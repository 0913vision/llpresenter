import {act, renderHook} from '@testing-library/react';
import {expect, it, onTestFinished} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {newSlidesItem} from '@core/services/slidesEdits';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {useShow} from '@renderer/session/show';
import {useSlidesItemWithBackground} from '@renderer/features/service/slides/SlidesVisuals';

it('keeps the draft without a row, follows a row background, and clears a removed background', () => {
  const previous = useShow.getState();
  onTestFinished(() => useShow.setState(previous));
  const item = {
    ...newSlidesItem(
      'blank',
      createServiceItemId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ),
    background: fixtureMedia.warm,
  };
  act(() => useShow.setState({rows: []}));
  const {result} = renderHook(() => useSlidesItemWithBackground(item));
  expect(result.current.background).toBe(fixtureMedia.warm);
  act(() =>
    useShow.setState({
      rows: [
        {
          id: item.id,
          kind: 'slides',
          title: 'slides',
          form: 'blank',
          background: {mediaId: fixtureMedia.dawn, loop: true},
        },
      ],
    }),
  );
  expect(result.current.background).toBe(fixtureMedia.dawn);
  act(() =>
    useShow.setState({
      rows: [{id: item.id, kind: 'slides', title: 'slides', form: 'blank'}],
    }),
  );
  expect(result.current.background).toBeUndefined();
});
