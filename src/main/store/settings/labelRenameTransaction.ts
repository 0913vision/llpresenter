import {hasSlides, type ServiceItem} from '@core/schema/services/service';
import {SLIDE_LIMITS, type Slide} from '@core/schema/slides/slide';
import type {EditResult} from '@core/schema/services/contentEdit';
import {
  parseSettingsEdit,
  type LabelRename,
} from '@core/schema/app/settingsDocuments';
import type {SettingsStore} from './settingsStore';
import type {ContentCommandContext} from '../content/contentCommands';

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
  const name = edit.to.trim();
  if (name.length === 0 || name.length > SLIDE_LIMITS.label) {
    return context.refuse(
      'invalid',
      'The slide label must contain 1 to 64 characters',
    );
  }
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
  if (current.value.labels.some(label => label.name === name)) {
    return context.refuse('invalid', 'Another label already has this name');
  }
  const affected = context.songs
    .all()
    .filter(song => song.data.slides.some(slide => slide.label === edit.from))
    .sort((a, b) => a.data.id.localeCompare(b.data.id));
  const usesLabel = (item: ServiceItem): boolean =>
    hasSlides(item) && item.slides.some(slide => slide.label === edit.from);
  const services = context.services
    .all()
    .filter(document => document.data.order.some(usesLabel));
  const templates = context.templates
    .all()
    .filter(document => document.data.order.some(usesLabel));
  if (
    [...affected, ...services, ...templates].some(
      document => document.access === 'readOnly',
    )
  ) {
    return context.refuse(
      'read-only',
      'A newer app version wrote an affected song',
    );
  }
  const full = context.savesFull(
    [...affected, ...services, ...templates].map(document => document.file),
  );
  if (full !== null) return full;
  const update = parseSettingsEdit({
    type: 'settings.update',
    name: 'labels',
    baseRevision: current.revision,
    value: {
      ...current.value,
      labels: current.value.labels.map(label =>
        label.name === edit.from ? {...label, name} : label,
      ),
    },
  });
  if (!update.ok) return context.refuse('invalid', update.error.message);
  const savedLabels = settings.apply(update.value);
  const next = settings.get('labels');
  if (next.revision === current.revision) return savedLabels;
  const renamed = (slide: Slide): Slide =>
    slide.label === edit.from ? {...slide, label: name} : slide;
  const changed = affected.map(song =>
    context.songs.replace(song, {
      ...song.data,
      slides: song.data.slides.map(renamed),
    }),
  );
  const renameItem = (item: ServiceItem): ServiceItem =>
    hasSlides(item) ? {...item, slides: item.slides.map(renamed)} : item;
  const changedServices = services.map(document =>
    context.services.replace(document, {
      ...document.data,
      order: document.data.order.map(renameItem),
    }),
  );
  const changedTemplates = templates.map(document =>
    context.templates.replace(document, {
      ...document.data,
      order: document.data.order.map(renameItem),
    }),
  );
  for (const document of changedServices) {
    context.announceService(document.data.id);
  }
  for (const document of changedTemplates) {
    context.announceTemplate(document.data.id);
  }
  for (const song of changed) context.announceSongDocument(song.data.id);
  await settings.savePending();
  const labelResult = await savedLabels;
  const saves = [
    ...changed.map(song =>
      context.saveSoon(context.kinds.song, context.songs, song.data.id),
    ),
    ...changedServices.map(document =>
      context.saveSoon(
        context.kinds.service,
        context.services,
        document.data.id,
      ),
    ),
    ...changedTemplates.map(document =>
      context.saveSoon(
        context.kinds.template,
        context.templates,
        document.data.id,
      ),
    ),
  ];
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
