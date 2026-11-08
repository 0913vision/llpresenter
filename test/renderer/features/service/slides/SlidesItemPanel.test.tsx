import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {createSlideId} from '@core/schema/ids';
import {newSlidesItem, SlidesDraft} from '@core/services/slidesEdits';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor';
import {SlidesItemPanel} from '@renderer/features/service/slides/SlidesItemPanel';
import {InlineSlidesPanels} from '@renderer/features/service/slides/InlineSlidesPanels';
import {SlidesListSession} from '@renderer/features/service/slides/slidesListSession';
import {
  itemFixture,
  fixtureItems,
  fixtureServiceId,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {fixtureMedia} from '@fixtures/core/mediaList';

vi.mock('@renderer/features/songs/editor/SongPreview', () => ({
  Picture: () => <div />,
}));
afterEach(cleanup);

it.each(['blank', 'ad'] as const)(
  'shows %s slide bands and opens the slides editor without an order editor',
  async form => {
    const fixture = itemFixture();
    const item = newSlidesItem(form, fixtureItems.plain);
    const first = item.slides.slides[0];
    if (first === undefined) throw new Error('Missing first slide');
    const updated = {
      ...item,
      slides: {
        ...item.slides,
        name: '이번 순서',
        slides: [
          {
            ...first,
            text: '첫 줄\n다음 줄',
            ...(form === 'ad' ? {name: '소식 이름'} : {}),
          },
          {
            id: createSlideId('00000000-0000-4000-8000-000000000099'),
            media: fixtureMedia.warm,
          },
        ],
      },
    };
    fixture.pushService({
      ...fixture.service(),
      service: {...fixture.service().service, order: [updated]},
    });
    const editor = new SongEditorStore(fixture.api, vi.fn());
    const items = new ServiceItemStore(fixture.api, editor, vi.fn());
    items.show({serviceId: fixtureServiceId, itemId: updated.id});
    const open = vi
      .spyOn(fixture.api.slidesEditor, 'open')
      .mockResolvedValue({ok: true, value: undefined});
    const view = render(
      <SlidesItemPanel
        api={fixture.api}
        items={items}
        item={updated}
        openEditor={fixture.api.slidesEditor.open}
      />,
    );
    expect(await screen.findByText('이번 순서')).toBeTruthy();
    expect(
      screen.getByRole('option', {
        name: form === 'ad' ? '1 소식 이름' : '1 첫 줄',
      }),
    ).toBeTruthy();
    expect(await screen.findByRole('option', {name: '2 a.png'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: '순서 편집…'})).toBeNull();
    await userEvent.click(screen.getByRole('button', {name: '슬라이드 편집…'}));
    expect(open).toHaveBeenCalledWith({
      serviceId: fixtureServiceId,
      itemId: updated.id,
    });
    view.unmount();
    const session = new SlidesListSession(new SlidesDraft(updated), {
      locked: () => false,
      problem: vi.fn(),
    });
    const inline = render(
      <InlineSlidesPanels
        api={fixture.api}
        session={session}
        onBack={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole('option', {
        name: form === 'ad' ? '1 소식 이름' : '1 첫 줄',
      }),
    ).toBeTruthy();
    expect(await screen.findByRole('option', {name: '2 a.png'})).toBeTruthy();
    expect(screen.queryByRole('checkbox', {hidden: true})).toBeNull();
    inline.unmount();
    items.dispose();
    await editor.dispose();
  },
);
