import type {Slide} from '@core/schema/slides/slide';
import type {SlideBackground} from '@core/schema/screens/theme';
import {gradientNamed} from '@core/theme';
import {makeSlide, type SlideMaking} from './make';

/** A 타이틀 that can be put in: its names and what is behind them. */
export interface TitleCard {
  readonly name: string;
  readonly english: string;
  readonly background?: SlideBackground | undefined;
}

/** The titles of a service of the church, in their order. */
export const SERVICE_TITLES: readonly TitleCard[] = (
  [
    ['묵상기도', '', '청록'],
    ['사도신경', "Apostle's Creed", '청록'],
    ['회개와간구의기도', 'Repentance Prayer', '적갈'],
    ['찬양', 'Praise', '초록'],
    ['합심기도', 'Corporate Prayer', '적갈'],
    ['봉헌', 'Offering', '자주'],
    ['봉헌기도', 'Offering Prayer', '자주'],
    ['성찬식', 'Holy Communion', '청록초록'],
    ['축복기도', 'Blessing', '남보라'],
    ['세례식', 'Baptism', '청록초록'],
    ['간구기도', 'Supplication Prayer', '적갈'],
    ['광고', 'Notice', '남보라'],
    ['축도', 'Benediction', '올리브'],
  ] as const
).map(([name, english, color]) => ({
  name,
  english,
  background: gradientNamed(color),
}));

/** A title of the service by its name. */
export function serviceTitle(name: string): TitleCard {
  const title = SERVICE_TITLES.find(entry => entry.name === name);
  if (title === undefined) throw new Error(`No title ${name}`);
  return title;
}

export function titleSlide(making: SlideMaking, title: TitleCard): Slide {
  return makeSlide(making, 'title', {
    texts: {
      제목: title.name,
      ...(title.english === '' ? {} : {영문: title.english}),
    },
    ...(title.background === undefined ? {} : {background: title.background}),
  });
}
