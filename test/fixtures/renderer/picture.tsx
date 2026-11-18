import {useContext, useLayoutEffect, useRef} from 'react';
import {PictureReadiness} from '@renderer/rendering/PictureReadiness';
import type {PictureSpec} from '@renderer/rendering/pictures/pictureService';

const specs = new WeakMap<HTMLElement, PictureSpec>();

export function Picture(spec: PictureSpec) {
  const onReady = useContext(PictureReadiness);
  const source = useRef({});
  useLayoutEffect(() => onReady?.(source.current), [onReady]);
  return (
    <div
      data-preview-ready="true"
      ref={node => {
        if (node !== null) specs.set(node, spec);
      }}
    />
  );
}

export function previewSpec(tile: ParentNode | null | undefined) {
  const picture = tile?.querySelector<HTMLElement>('[data-preview-ready]');
  return picture == null ? undefined : specs.get(picture);
}
