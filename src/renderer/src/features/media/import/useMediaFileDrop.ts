import type {DragEvent} from 'react';
import {MEDIA_LIMITS} from '@core/schema/media/mediaList';

/** Files dropped from the desktop onto the media view are imported. */
export function useMediaFileDrop({
  reason,
  isPending,
  startImport,
}: {
  /** Why nothing can be imported now. */
  readonly reason: string | undefined;
  readonly isPending: () => boolean;
  readonly startImport: (files: readonly File[]) => void;
}) {
  const dragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect =
      reason === undefined && !isPending() ? 'copy' : 'none';
  };
  const drop = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    if (reason !== undefined || isPending()) return;
    const files = [...event.dataTransfer.files].slice(
      0,
      MEDIA_LIMITS.importBatch,
    );
    if (files.length > 0) startImport(files);
  };
  return {dragOver, drop};
}
