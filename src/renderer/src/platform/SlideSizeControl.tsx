import type {JSX} from 'react';
import {ThumbnailSizeControl} from '@renderer/ui/choices/ThumbnailSizeControl';
import type {ListWorkspace} from '@renderer/ui/lists/workspace';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from './thumbnailScale';
import type {SizeClass} from '@core/schema/app/appConfig';

/** Changes and saves the shared slide-grid scale for one size class. */
export function SlideSizeControl({
  sizeClass,
  workspace = 'show',
}: {
  readonly sizeClass: SizeClass;
  readonly workspace?: ListWorkspace | undefined;
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
