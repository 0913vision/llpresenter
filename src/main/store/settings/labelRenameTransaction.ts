import {
  hasSlides,
  type ServiceItem,
  type Service,
  type Template,
} from '@core/schema/services/service';
import {SLIDE_LIMITS, type Slide} from '@core/schema/slides/slide';
import type {EditResult} from '@core/schema/services/contentEdit';
import {
  parseSettingsEdit,
  type LabelRename,
} from '@core/schema/app/settingsDocuments';
import type {SettingsStore} from './settingsStore';
import type {ContentCommandContext, Written} from '../content/contentCommands';
import type {DocumentCollection} from '../files/documents';
import type {Song} from '@core/schema/songs/song';

/** The songs, 예배 and 템플릿 that have a slide with a label. */
interface LabelUsers {
  readonly songs: ReturnType<DocumentCollection<Song>['all']>;
  readonly services: ReturnType<DocumentCollection<Service>['all']>;
  readonly templates: ReturnType<DocumentCollection<Template>['all']>;
}

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
  const refusal = labelListRefusal(context, current, {...edit, to: name});
  if (refusal !== null) return refusal;
  const users = labelUsers(context, edit.from);
  const documents = [...users.songs, ...users.services, ...users.templates];
  if (documents.some(document => document.access === 'readOnly')) {
    return context.refuse(
      'read-only',
      'A newer app version wrote an affected song',
    );
  }
  const full = context.savesFull(documents.map(document => document.file));
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
  const saves = relabel(context, users, {from: edit.from, to: name});
  await settings.savePending();
  const labelResult = await savedLabels;
  return {
    saved: Promise.all(saves).then(written =>
      withLabelResult(
        labelResult,
        context.answer({id: 'labels', revision: next.revision}, written),
      ),
    ),
  };
}

/** Why the label list can't take the rename now, or null when it can. */
function labelListRefusal(
  context: ContentCommandContext,
  current: Extract<ReturnType<SettingsStore['get']>, {name: 'labels'}>,
  edit: LabelRename,
): EditResult | null {
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
  return null;
}

/** The songs, 예배 and 템플릿 with a slide labelled `label`, songs by id. */
function labelUsers(context: ContentCommandContext, label: string): LabelUsers {
  const usesLabel = (item: ServiceItem): boolean =>
    hasSlides(item) && item.slides.some(slide => slide.label === label);
  return {
    songs: context.songs
      .all()
      .filter(song => song.data.slides.some(slide => slide.label === label))
      .sort((a, b) => a.data.id.localeCompare(b.data.id)),
    services: context.services
      .all()
      .filter(document => document.data.order.some(usesLabel)),
    templates: context.templates
      .all()
      .filter(document => document.data.order.some(usesLabel)),
  };
}

/**
 * Gives every slide of `users` labelled `from` the label `to`, tells the
 * windows, and answers the saves that are coming.
 */
function relabel(
  context: ContentCommandContext,
  users: LabelUsers,
  {from, to}: {readonly from: string; readonly to: string},
): Array<Promise<Written>> {
  const renamed = (slide: Slide): Slide =>
    slide.label === from ? {...slide, label: to} : slide;
  const renameItem = (item: ServiceItem): ServiceItem =>
    hasSlides(item) ? {...item, slides: item.slides.map(renamed)} : item;
  const songs = users.songs.map(song =>
    context.songs.replace(song, {
      ...song.data,
      slides: song.data.slides.map(renamed),
    }),
  );
  const services = users.services.map(document =>
    context.services.replace(document, {
      ...document.data,
      order: document.data.order.map(renameItem),
    }),
  );
  const templates = users.templates.map(document =>
    context.templates.replace(document, {
      ...document.data,
      order: document.data.order.map(renameItem),
    }),
  );
  for (const document of services) context.announceService(document.data.id);
  for (const document of templates) context.announceTemplate(document.data.id);
  for (const song of songs) context.announceSongDocument(song.data.id);
  return [
    ...songs.map(song =>
      context.saveSoon(context.kinds.song, context.songs, song.data.id),
    ),
    ...services.map(document =>
      context.saveSoon(
        context.kinds.service,
        context.services,
        document.data.id,
      ),
    ),
    ...templates.map(document =>
      context.saveSoon(
        context.kinds.template,
        context.templates,
        document.data.id,
      ),
    ),
  ];
}

/**
 * The answer of a label rename: the documents' answer, unless the label list
 * itself failed, whose failure then lists the unchanged files of both.
 */
function withLabelResult(
  labelResult: EditResult,
  documentsResult: EditResult,
): EditResult {
  if (labelResult.ok) return documentsResult;
  if (labelResult.error.reason !== 'write-failed') return labelResult;
  return {
    ok: false,
    error: {
      ...labelResult.error,
      unchangedFiles: [
        ...labelResult.error.unchangedFiles,
        ...(documentsResult.ok ||
        documentsResult.error.reason !== 'write-failed'
          ? []
          : documentsResult.error.unchangedFiles),
      ],
    },
  };
}
