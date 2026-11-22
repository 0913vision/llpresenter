import {describe, expect, it} from 'vitest';
import {
  powerpointDarkLyrics,
  powerpointSlides,
  type PowerPointShape,
  type PowerPointSlide,
} from '@core/songs/powerpointSlides';

type Read = Omit<PowerPointSlide, 'number'>;

function slide(
  background: string,
  ...shapes: ReadonlyArray<PowerPointShape | string>
): Read {
  return {
    background,
    textColor: 0xffffff,
    shapes: shapes.map(shape =>
      typeof shape === 'string'
        ? {role: 'free', lines: shape.split('\n')}
        : shape,
    ),
  };
}

function read(...slides: readonly Read[]) {
  return powerpointSlides(
    slides.map((entry, index) => ({...entry, number: index + 1})),
  );
}

describe('powerpointSlides', () => {
  it('reads the first slide on a new background as the title of a song', () => {
    expect(
      read(
        slide('a', '빛의 길'),
        slide('a', '맑은 아침이 밝아 오네'),
        slide('a', '새 노래를 함께 부르네'),
        slide('b', '넓은 들을\n걸어가네'),
        slide('b', '넓은 들을 함께 걸어가네'),
        slide('b', '바람이 불어 오네'),
      ).map(entry => [entry.titleSlide === true, entry.lines]),
    ).toEqual([
      [true, ['빛의 길']],
      [false, ['맑은 아침이 밝아 오네']],
      [false, ['새 노래를 함께 부르네']],
      [true, ['넓은 들을', '걸어가네']],
      [false, ['넓은 들을 함께 걸어가네']],
      [false, ['바람이 불어 오네']],
    ]);
  });

  it('reads no title where the background shows on few slides', () => {
    const out = read(
      slide('a', '빛의 길'),
      slide('a', '맑은 아침이 밝아 오네'),
      slide('a', '새 노래를 함께 부르네'),
      slide('b', '후렴'),
      slide('a', '끝'),
    );
    expect(out.filter(entry => entry.titleSlide === true)).toHaveLength(1);
  });

  it('puts the largest row of a title first', () => {
    const title: PowerPointShape = {
      role: 'free',
      lines: ['새찬송가 91장', '슬픈 마음 있는 사람'],
      main: 1,
    };
    expect(
      read(
        slide('a', title),
        slide('a', '슬픈 마음 있는 사람 예수 이름 믿으면'),
        slide('a', '영원토록 변함 없는'),
      )[0],
    ).toEqual({
      titleSlide: true,
      lines: ['슬픈 마음 있는 사람', '새찬송가 91장'],
    });
  });

  it('reads the title again where the song shows it again', () => {
    const out = read(
      slide('a', '빛의 길'),
      slide('a', '맑은 아침이 밝아 오네'),
      slide('a', '새 노래를 함께 부르네'),
      slide('a', '빛의 길'),
    );
    expect(out[3]).toEqual({titleSlide: true, lines: ['빛의 길']});
  });

  it('never reads a slide with a body as a title', () => {
    expect(
      read(
        slide('a', {role: 'body', lines: ['맑은 아침이 밝아 오네']}),
        slide('a', '새 노래를'),
        slide('a', '부르네'),
      )[0],
    ).toEqual({lines: ['맑은 아침이 밝아 오네']});
  });
});

describe('powerpointDarkLyrics', () => {
  it('counts the slides that write in a dark color', () => {
    const at = (textColor: number, number: number): PowerPointSlide => ({
      ...slide('a', '가사'),
      textColor,
      number,
    });
    expect(powerpointDarkLyrics([at(0, 1), at(0, 2), at(0xffffff, 3)])).toBe(
      true,
    );
    expect(powerpointDarkLyrics([at(0, 1), at(0xffffff, 2)])).toBe(false);
  });
});
