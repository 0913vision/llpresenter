import {useLayoutEffect, useState, type ReactNode} from 'react';
import {PrepFrameStatus} from '@renderer/rendering/PrepPictureSwitch';

/** Keeps previously shown preparation frames in the document while hidden. */
export function KeptPrepFrames({
  identity,
  children,
}: {
  readonly identity: string;
  readonly children: ReactNode;
}) {
  const [frames] = useState(() => new Map<string, ReactNode>());
  const [seen, setSeen] = useState<readonly string[]>([]);
  if (!seen.includes(identity)) setSeen([...seen, identity]);
  useLayoutEffect(() => {
    frames.set(identity, children);
  });
  return seen.map(key => (
    <div
      key={key}
      data-slide-grid-cache
      data-prep-cached-frame={key}
      aria-hidden={key !== identity}
      inert={key !== identity}
      style={{display: key === identity ? 'contents' : 'none'}}
    >
      <PrepFrameStatus
        value={{active: key === identity, retained: frames.has(key)}}
      >
        {key === identity ? children : frames.get(key)}
      </PrepFrameStatus>
    </div>
  ));
}
