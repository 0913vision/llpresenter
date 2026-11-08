import {rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {MediaEditResult} from '@core/schema/mediaEdit';
import type {MediaStore} from './mediaStore';
import {initialPictures, type InitialPicture} from './initialPictures';
import {mediaRefusal} from './mediaEdits';

type PictureStore = Pick<MediaStore, 'get' | 'add' | 'folder'>;
const pending = new WeakMap<PictureStore, Promise<MediaEditResult>>();

/** Adds only absent bundled IDs, preserving operator replacements and existing files. */
export function prepareSectionPictures(
  store: PictureStore,
  pictures: readonly InitialPicture[],
): Promise<MediaEditResult> {
  const existing = pending.get(store);
  if (existing !== undefined) return existing;
  const operation = (async (): Promise<MediaEditResult> => {
    const document = store.get();
    const missing = pictures.filter(
      picture => !document.value.items.some(item => item.id === picture.id),
    );
    if (missing.length === 0) return {ok: true, value: null};
    if (document.access === 'readOnly') {
      return mediaRefusal('read-only', 'A newer app version wrote this file');
    }
    const created: string[] = [];
    try {
      const copied = await initialPictures(store.folder, missing, file => {
        created.push(file);
      });
      const latest = store.get();
      const items = copied.filter(
        picture => !latest.value.items.some(item => item.id === picture.id),
      );
      return items.length === 0
        ? {ok: true, value: null}
        : await store.add({baseRevision: latest.revision, items}, null);
    } finally {
      /** A failed save can still apply the batch; keep every catalogued file. */
      await Promise.all(
        created.map(async file => {
          const referenced = store
            .get()
            .value.items.some(
              item => resolve(store.folder, item.file) === resolve(file),
            );
          if (!referenced) await rm(file, {force: true});
        }),
      );
    }
  })().finally(() => {
    pending.delete(store);
  });
  pending.set(store, operation);
  return operation;
}
