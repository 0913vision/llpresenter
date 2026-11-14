import {describe, expect, it} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {powerpointImageItem} from '@core/services/powerpointImages';
import {IMAGE_SLIDES_THEME_ID} from '@core/themes/defaults';

describe('PowerPoint image item', () => {
  it('keeps picture order and uses the image slide theme', () => {
    const media = [
      createMediaId('00000000-0000-4000-8000-000000000001'),
      createMediaId('00000000-0000-4000-8000-000000000002'),
    ];
    const item = powerpointImageItem('Service.pptm', media);
    expect(item.theme).toBe(IMAGE_SLIDES_THEME_ID);
    expect(item.slides.form).toBe('blank');
    expect(item.slides.name).toBe('Service');
    expect(
      item.slides.slides.map(slide => ('media' in slide ? slide.media : null)),
    ).toEqual(media);
    expect(new Set(item.slides.slides.map(slide => slide.id)).size).toBe(2);
  });
});
