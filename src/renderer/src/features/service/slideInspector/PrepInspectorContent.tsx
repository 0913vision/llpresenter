import type {ComponentProps, JSX} from 'react';
import {AtomicPictureContent} from '@renderer/rendering/AtomicPictureContent';
import {usePrepPictureSwitch} from '@renderer/rendering/PrepPictureSwitch';

/** The deferred preparation frame waits for its pictures as a whole. */
export function PrepInspectorContent(
  props: ComponentProps<typeof AtomicPictureContent>,
): JSX.Element {
  const switching = usePrepPictureSwitch();
  if (switching === undefined) return <AtomicPictureContent {...props} />;
  return (
    <>
      {props.content}
      {props.aside}
    </>
  );
}
