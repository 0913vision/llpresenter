import type {OutputMediaProperties} from '../schema/outputMedia';

/** Maps fit, fill, and stretch to CSS contain, cover, and fill, respectively. */
export function mediaObjectFit(
  fit: OutputMediaProperties['fit'],
): 'contain' | 'cover' | 'fill' {
  switch (fit) {
    case 'fit':
      return 'contain';
    case 'fill':
      return 'cover';
    case 'stretch':
      return 'fill';
    default: {
      const unhandled: never = fit;
      return unhandled;
    }
  }
}
