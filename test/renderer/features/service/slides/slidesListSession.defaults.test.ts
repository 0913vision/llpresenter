import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {defaultSlideTransitions} from '@core/schema/preferences';
import {newSlidesItem, SlidesDraft} from '@core/services/slidesEdits';
import {SlidesListSession} from '@renderer/features/service/slides/slidesListSession';

describe('slide item paste defaults', () => {
  it.each(['blank', 'ad'] as const)(
    'uses the destination default for %s plain text and preserves copied transitions',
    form => {
      const id = createServiceItemId('00000000-0000-4000-8000-000000000001');
      const source = {kind: 'dissolve', sec: 1} as const;
      const target = {kind: 'wipe', dir: 'right', sec: 2} as const;
      const draft = new SlidesDraft(newSlidesItem(form, id, source));
      const session = new SlidesListSession(draft, {
        locked: () => false,
        problem: () => undefined,
      });
      session.setSlideDefaults({...defaultSlideTransitions, [form]: target});
      session.selectSlides({type: 'gap', index: 1});
      session.pasteSlides('external');
      expect(draft.snapshot.item.slides.slides[1]?.transition).toEqual(target);
      const first = draft.snapshot.item.slides.slides[0];
      if (!first) throw new Error('Missing slide');
      session.selectSlides({type: 'click', id: first.id});
      const copied = session.copySlides();
      if (copied === null) throw new Error('Missing clipboard');
      session.selectSlides({type: 'gap', index: 2});
      session.pasteSlides(copied);
      expect(draft.snapshot.item.slides.slides[2]?.transition).toEqual(source);
    },
  );
});
