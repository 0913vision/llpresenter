import type {JSX} from 'react';
import {Picture} from './pictures/Picture';
import {pictureSpec} from './pictureSpec';
import type {SlideInput} from './outputSlideSpec';

/** Displays the compositor's shared image of a prepared slide. */
export function OutputSlidePicture({
  drawn,
  editing = false,
  ...input
}: SlideInput & {
  readonly drawn?: 'wait' | 'place' | undefined;
  readonly editing?: boolean | undefined;
}): JSX.Element {
  const spec = pictureSpec({kind: 'slide', input}).spec;
  return <Picture wait={drawn === 'wait'} editing={editing} {...spec} />;
}
