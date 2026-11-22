import type {SlidePurpose, ThemeFile} from '../schema/theme';
import {AUTO_TOKENS, type SlideContent} from './content';

const AUTO: SlideContent['auto'] = {
  [AUTO_TOKENS.label]: '1절',
  [AUTO_TOKENS.newLabel]: '1절',
  [AUTO_TOKENS.number]: '1',
  [AUTO_TOKENS.passage]: '요한복음 3:16',
  [AUTO_TOKENS.song]: '슬픈 마음 있는 사람',
  [AUTO_TOKENS.hymn]: '91장 슬픈 마음 있는 사람',
  [AUTO_TOKENS.item]: '찬양',
};

const TEXTS: Readonly<Record<string, string>> = {
  가사: '슬픈 마음 있는 사람\n예수 이름 믿으면',
  제목: '찬양',
  부제: '91장',
  영문: 'Praise',
  본문: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라',
  내용: '예배 후에 식사를 함께합니다\n새가족 모임이 있습니다',
};

const TITLES: Readonly<Partial<Record<SlidePurpose, string>>> = {
  songTitle: '슬픈 마음 있는 사람',
  sermonTitle: '하나님의 사랑',
  notice: '예배 안내',
};

/** What the editor writes in the boxes of a theme, to show their places. */
export function sampleContent(
  theme: Pick<ThemeFile, 'boxes' | 'purpose'>,
): SlideContent {
  return {
    texts: Object.fromEntries(
      theme.boxes
        .filter(box => box.default === undefined)
        .map(box => [
          box.name,
          (box.name === '제목' ? TITLES[theme.purpose] : undefined) ??
            TEXTS[box.name] ??
            (box.rows === 'one' ? box.name : `${box.name}\n${box.name}`),
        ]),
    ),
    auto: AUTO,
  };
}
