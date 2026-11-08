import type {TextStyle} from '@core/themes/textStyle';

type BulletText = Pick<TextStyle, 'bulletStyle'>;

export function bulletIndent(text: BulletText): number {
  return (text.bulletStyle === 'disc' ? 107 : 90) / 86;
}

/** Shares hanging geometry between output, previews and fixed-size text measurement. */
export function bulletTextStyle(text: BulletText) {
  const disc = text.bulletStyle === 'disc';
  return {
    '--bullet-indent': `${bulletIndent(text)}em`,
    '--bullet-gap': `${disc ? 0 : 23 / 86}em`,
    '--bullet-offset': `${disc ? 0 : -7 / 86}em`,
    '--bullet-visibility': disc ? 'hidden' : 'visible',
    '--bullet-disc-content': disc ? '""' : 'none',
    '--bullet-disc-left': `${19 / 86}em`,
    '--bullet-disc-top': `${56 / 86}em`,
    '--bullet-disc-size': `${20 / 86}em`,
    '--bullet-wrap': disc ? 'normal' : 'break-word',
  };
}

/** Preserves empty paragraphs and leaves automatic wrapping to the text frame. */
export function textParagraphs(lines: readonly string[]): readonly string[] {
  return lines.flatMap(line => line.split(/\r?\n/u));
}
