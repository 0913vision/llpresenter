import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {
  isItemOfKind,
  parseService,
  parseTemplate,
  serializeService,
  serializeTemplate,
  serviceItemKind,
  serviceSchema,
  SLIDES_LIMITS,
  slideSchema,
  type ServiceItemOf,
  type Slide,
} from '@core/schema/service';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FILE = 'service.llservice';
const textSlide = {id: uuid(3), text: 'First line\nSecond line'};
const mediaSlide = {id: uuid(4), media: uuid(5)};
const slides = {form: 'ad', name: 'Announcements', slides: [textSlide]};
const item = {id: uuid(2), slides};
const service = {
  format: 'llservice',
  schemaVersion: 1,
  id: uuid(1),
  name: 'Sunday',
  date: '2026-11-01T11:00',
  order: [item],
};
const accepts = (value: object) =>
  v.safeParse(serviceSchema, {...service, order: [value]}).success;

describe('slides items', () => {
  it.each(['blank', 'ad'])('round-trips %s text and picture slides', form => {
    const raw = {
      ...service,
      order: [
        {...item, slides: {...slides, form, slides: [textSlide, mediaSlide]}},
      ],
    };
    const loaded = expectSuccess(parseService(JSON.stringify(raw), FILE)).data;
    const found = loaded.order.find(value => isItemOfKind(value, 'slides'));
    expect(found).toBeDefined();
    if (found === undefined) throw new Error('Missing slides item');
    const typedItem: ServiceItemOf<'slides'> = found;
    const typedSlides: readonly Slide[] = typedItem.slides.slides;
    expect(typedSlides).toEqual([textSlide, mediaSlide]);
    expect(serviceItemKind(found)).toBe('slides');
    expect(JSON.parse(expectSuccess(serializeService(loaded, FILE)))).toEqual(
      raw,
    );

    const {date: _date, ...template} = raw;
    const parsed = expectSuccess(parseTemplate(JSON.stringify(template), FILE));
    expect(
      JSON.parse(expectSuccess(serializeTemplate(parsed.data, FILE))),
    ).toEqual(template);
  });

  it('keeps item fields, named ad text, and nested extensions through a file round trip', () => {
    const raw = {
      ...service,
      order: [
        {
          ...item,
          theme: uuid(6),
          background: uuid(5),
          macro: uuid(7),
          memo: 'Memo\nNext line',
          overlays: [
            {
              id: uuid(8),
              name: 'Overlay',
              from: 1,
              to: 1,
              screens: [uuid(9)],
              content: {text: 'Overlay text'},
            },
          ],
          future: true,
          slides: {
            ...slides,
            advance: 8,
            loop: true,
            future: 1,
            slides: [
              {...textSlide, name: 'Event', future: 2},
              {...mediaSlide, future: {kept: true}},
            ],
          },
        },
      ],
    };
    const loaded = expectSuccess(parseService(JSON.stringify(raw), FILE));
    expect(
      JSON.parse(expectSuccess(serializeService(loaded.data, FILE))),
    ).toEqual(raw);
  });

  it('accepts empty text, names, and slide lists and optional false looping', () => {
    for (const source of [[], [{...textSlide, text: '', name: ''}]]) {
      expect(
        accepts({
          ...item,
          slides: {
            ...slides,
            name: '',
            slides: source,
            loop: false,
            advance: 0.5,
          },
        }),
      ).toBe(true);
    }
  });

  it.each([0.1, 3, 8, 30])('accepts positive advance seconds %s', advance => {
    expect(accepts({...item, slides: {...slides, advance}})).toBe(true);
  });

  it.each([
    {form: 'other'},
    {form: undefined},
    {name: 1},
    {name: undefined},
    {name: 'x'.repeat(SLIDES_LIMITS.name + 1)},
    {slides: undefined},
    {slides: {}},
    {slides: [null]},
    {advance: 0},
    {advance: -1},
    {advance: NaN},
    {advance: Infinity},
    {advance: '8'},
    {advance: null},
    {advance: undefined},
    {loop: 1},
    {loop: 'true'},
    {loop: null},
    {loop: undefined},
  ])('rejects invalid item content %j', patch => {
    expect(accepts({...item, slides: {...slides, ...patch}})).toBe(false);
  });

  it.each([
    {id: 'missing'},
    {theme: 'missing'},
    {background: 'missing'},
    {macro: 1},
    {memo: 1},
    {overlays: {}},
    {song: uuid(10)},
  ])('rejects invalid shared fields or mixed item kinds %j', patch => {
    expect(accepts({...item, ...patch})).toBe(false);
  });

  it('rejects slide names in blank items, including an empty name', () => {
    for (const name of ['Event', '']) {
      expect(
        accepts({
          ...item,
          slides: {...slides, form: 'blank', slides: [{...textSlide, name}]},
        }),
      ).toBe(false);
    }
  });

  it('bounds names and text at the song title and live text caps', () => {
    expect(
      accepts({
        ...item,
        slides: {
          ...slides,
          name: 'x'.repeat(SLIDES_LIMITS.name),
          slides: [
            {
              ...textSlide,
              name: 'x'.repeat(SLIDES_LIMITS.name),
              text: 'x'.repeat(SLIDES_LIMITS.text),
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it('accepts 200 unique slides and rejects 201 or a repeated id across variants', () => {
    const source = Array.from({length: SLIDES_LIMITS.slides}, (_, n) => ({
      ...textSlide,
      id: uuid(n + 20),
    }));
    expect(accepts({...item, slides: {...slides, slides: source}})).toBe(true);
    expect(
      accepts({...item, slides: {...slides, slides: [...source, mediaSlide]}}),
    ).toBe(false);
    expect(
      accepts({
        ...item,
        slides: {
          ...slides,
          slides: [textSlide, {...mediaSlide, id: textSlide.id}],
        },
      }),
    ).toBe(false);
    expect(
      v.safeParse(serviceSchema, {
        ...service,
        order: [item, {...item, id: uuid(10)}],
      }).success,
    ).toBe(true);
  });
});

describe('slide variants', () => {
  it.each([
    {},
    {id: uuid(3)},
    {...textSlide, id: 'missing'},
    {...textSlide, id: undefined},
    {...textSlide, text: 1},
    {...textSlide, text: undefined},
    {...textSlide, text: 'x'.repeat(SLIDES_LIMITS.text + 1)},
    {...textSlide, name: 1},
    {...textSlide, name: undefined},
    {...textSlide, name: 'x'.repeat(SLIDES_LIMITS.name + 1)},
    {...mediaSlide, media: 'missing'},
    {...mediaSlide, media: undefined},
    {...textSlide, media: uuid(5)},
    {...mediaSlide, name: 'Event'},
    {...mediaSlide, text: undefined},
    {...mediaSlide, name: undefined},
    [],
    null,
  ])('rejects malformed, mixed, or oversized slides %j', value => {
    expect(v.safeParse(slideSchema, value).success).toBe(false);
  });
});
