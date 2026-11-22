import type {Slide} from '@core/schema/slide';
import {slidesText} from '@core/slides/edits';
import {readSlideText, writeSlideText} from './systemSlideClipboard';

interface Copied {
  readonly slides: readonly Slide[];
  readonly text: string;
}

const owner = {};
let copied: Copied | null = null;

/** Copies slides, and their texts for other programs. */
export function copySlides(slides: readonly Slide[]): string {
  copied = {slides, text: slidesText(slides)};
  writeSlideText(owner, copied.text);
  return copied.text;
}

/** The slides a text was copied from, unless it came from elsewhere. */
export function slidesCopiedAs(text: string): readonly Slide[] | undefined {
  return copied !== null && copied.text === text.replace(/\r\n?/gu, '\n')
    ? copied.slides
    : undefined;
}

/** The text in the clipboard, after the latest copy has reached it. */
export async function clipboardText(): Promise<string> {
  try {
    return await readSlideText(owner);
  } catch (error) {
    console.error('Could not read slide text', error);
    return copied?.text ?? '';
  }
}
