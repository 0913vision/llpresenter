import type {EditResult} from '@core/schema/contentEdit';
import {
  parseSettingsEdit,
  type LabelRename,
} from '@core/schema/settingsDocuments';
import type {SettingsStore} from './settingsStore';
import type {ContentCommandContext} from './contentCommands';

/**
 * Prepares the existing label/reference rewrite and returns its pending save
 * separately. The caller serializes preparation and waits for that save outside
 * its edit queue; this operation does not introduce another queue.
 */
export async function prepareLabelRename(
  context: ContentCommandContext,
  settings: SettingsStore,
  edit: LabelRename,
): Promise<EditResult | {readonly saved: Promise<EditResult>}> {
  await context.flushAutosave();
  const current = settings.get('labels');
  if (current.name !== 'labels') {
    return context.refuse('not-found', 'The label list is unavailable');
  }
  if (current.access === 'readOnly') {
    return context.refuse(
      'read-only',
      'A newer app version wrote the label list',
    );
  }
  if (current.revision !== edit.baseRevision) {
    return context.refuse(
      'stale',
      `The label list is at revision ${current.revision}`,
    );
  }
  if (!current.value.labels.some(label => label.name === edit.from)) {
    return context.refuse('not-found', 'The label no longer exists');
  }
  if (current.value.labels.some(label => label.name === edit.to)) {
    return context.refuse('invalid', 'Another label already has this name');
  }
  const affected = context.songs
    .all()
    .filter(song => song.data.groups.some(group => group.name === edit.from))
    .sort((a, b) => a.data.id.localeCompare(b.data.id));
  if (affected.some(song => song.access === 'readOnly')) {
    return context.refuse(
      'read-only',
      'A newer app version wrote an affected song',
    );
  }
  const full = context.savesFull(affected.map(song => song.file));
  if (full !== null) return full;
  const update = parseSettingsEdit({
    type: 'settings.update',
    name: 'labels',
    baseRevision: current.revision,
    value: {
      ...current.value,
      labels: current.value.labels.map(label =>
        label.name === edit.from ? {...label, name: edit.to} : label,
      ),
    },
  });
  if (!update.ok) return context.refuse('invalid', update.error.message);
  const savedLabels = settings.apply(update.value);
  const next = settings.get('labels');
  if (next.revision === current.revision) return savedLabels;
  const changed = affected.map(song =>
    context.songs.replace(song, {
      ...song.data,
      groups: song.data.groups.map(group =>
        group.name === edit.from ? {...group, name: edit.to} : group,
      ),
    }),
  );
  for (const song of changed) context.announceSongDocument(song.data.id);
  await settings.savePending();
  const labelResult = await savedLabels;
  const saves = changed.map(song =>
    context.saveSoon(context.kinds.song, context.songs, song.data.id),
  );
  return {
    saved: Promise.all(saves).then(written => {
      const songsResult = context.answer(
        {id: 'labels', revision: next.revision},
        written,
      );
      if (labelResult.ok) return songsResult;
      if (labelResult.error.reason !== 'write-failed') return labelResult;
      return {
        ok: false,
        error: {
          ...labelResult.error,
          unchangedFiles: [
            ...labelResult.error.unchangedFiles,
            ...(songsResult.ok || songsResult.error.reason !== 'write-failed'
              ? []
              : songsResult.error.unchangedFiles),
          ],
        },
      };
    }),
  };
}
