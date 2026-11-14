import type {SlideTransition} from '../schema/slideTransition';

/** The transition assigned to passages opened from quick run. */
export const QUICK_BIBLE_TRANSITION: SlideTransition = {
  kind: 'wipe',
  dir: 'left',
  sec: 0.7,
};
