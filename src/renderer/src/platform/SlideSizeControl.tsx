import type {JSX} from 'react';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import type {SizeClass} from '@renderer/ui/sizeClass';
import type {Workspace} from '@renderer/ui/workspace';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from './thumbnailScale';

/** Changes and saves the shared slide-grid scale for one size class. */
export function SlideSizeControl({
  sizeClass,
  workspace = 'show',
}: {
  readonly sizeClass: SizeClass;
  readonly workspace?: Workspace | undefined;
}): JSX.Element {
  const scale = useThumbnailScale(sizeClass);
  return (
    <ThumbnailSizeControl
      key={sizeClass}
      workspace={workspace}
      compact
      value={scale}
      onChange={percent => showThumbnailScale(sizeClass, percent)}
      onCommit={percent => saveThumbnailScale(sizeClass, percent)}
    />
  );
}
