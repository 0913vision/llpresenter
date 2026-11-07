import {describe, expect, it} from 'vitest';
import {
  createServiceItemId,
  createSlideId,
  createMediaId,
  translationIdSchema,
} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import {SLIDE_CLIPBOARD_LIMITS} from '@core/schema/slideClipboard';
import {
  newSlidesItem,
  SlidesDraft,
  type Slide,
} from '@core/services/slidesEdits';
import {
  pasteRowClipboard,
  readRowClipboardEvent,
  rowClipboardData,
  writeRowClipboardEvent,
} from '@renderer/features/service/slides/slideRowsClipboard';

const id = createServiceItemId('10000000-0000-4000-8000-000000000001');
const slideId = createSlideId('20000000-0000-4000-8000-000000000001');
function payload() {
  const translation = parsePayload(translationIdSchema, 'krv');
  if (!translation.ok) throw new Error('Invalid translation');
  const slides: Slide[] = [
    {
      id: slideId,
      verse: {translation: translation.value, book: 43, chapter: 3, verse: 16},
    },
    {
      id: createSlideId('20000000-0000-4000-8000-000000000002'),
      media: createMediaId('30000000-0000-4000-8000-000000000001'),
    },
  ];
  const data = rowClipboardData('blank', {slides, text: '요한복음 3:16'});
  if (!data) throw new Error('Missing payload');
  return {slides, data};
}
describe('structured slide row clipboard', () => {
  it('round-trips verse references and pictures via custom format or HTML across windows', () => {
    const {slides, data} = payload();
    const values = new Map<string, string>();
    const transfer = {
      setData: (type: string, value: string) => {
        values.set(type, value);
      },
      getData: (type: string) => values.get(type) ?? '',
    };
    writeRowClipboardEvent(transfer, data);
    expect(readRowClipboardEvent(transfer)).toEqual(data);
    values.delete('application/x-llp-slide-rows');
    expect(readRowClipboardEvent(transfer)).toEqual(data);
    const draft = new SlidesDraft(newSlidesItem('blank', id));
    expect(pasteRowClipboard(draft, readRowClipboardEvent(transfer))).toBe(
      true,
    );
    const inserted = draft.snapshot.item.slides.slides.slice(1);
    expect({...inserted[0], id: slides[0]?.id}).toEqual(slides[0]);
    expect({...inserted[1], id: slides[1]?.id}).toEqual(slides[1]);
    expect(inserted[0]?.id).not.toBe(slideId);
    draft.undo();
    expect(draft.snapshot.item.slides.slides).toHaveLength(1);
  });
  it('refuses mismatched forms, malformed structures, invalid references, and oversized payloads atomically', () => {
    const draft = new SlidesDraft(newSlidesItem('ad', id));
    const before = draft.snapshot;
    expect(pasteRowClipboard(draft, payload().data)).toBe(false);
    for (const rows of [
      '{',
      JSON.stringify({
        format: 'llp-slide-rows',
        version: 1,
        content: {
          form: 'ad',
          name: '',
          slides: [{id: slideId, verse: {book: -1}}],
        },
      }),
      'x'.repeat(SLIDE_CLIPBOARD_LIMITS.characters + 1),
    ]) {
      expect(
        pasteRowClipboard(draft, {
          rows,
          text: 'Should not replace invalid structured data',
        }),
      ).toBe(false);
      expect(draft.snapshot).toBe(before);
    }
  });
  it('turns plain song lines into blank text rows without adding ad names', () => {
    const draft = new SlidesDraft(newSlidesItem('blank', id));
    expect(
      pasteRowClipboard(draft, {
        rows: '',
        text: '첫 줄\n둘째 줄\n\n다음 슬라이드',
      }),
    ).toBe(true);
    expect(
      draft.snapshot.item.slides.slides
        .slice(1)
        .map(slide => ('text' in slide ? slide.text : '')),
    ).toEqual(['첫 줄\n둘째 줄', '다음 슬라이드']);
    expect(
      draft.snapshot.item.slides.slides.every(slide => !('name' in slide)),
    ).toBe(true);
  });
});
