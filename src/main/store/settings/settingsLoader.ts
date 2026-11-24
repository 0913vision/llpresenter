import {basename} from 'node:path';
import type {
  FileAccess,
  FileError,
  LoadedFile,
} from '@core/schema/common/fileFormat';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/app/settingsDocuments';
import type {DataLocations} from '../locations/locations';
import type {Saver} from '../files/saver';
import {settingsCodecs, type SettingsValue} from './settingsCodecs';
import {settingsDefaults} from './settingsDefaults';
import {readSettingsFile, settingsLocation} from './settingsFile';
import {DEFAULT_VERSE_LABEL} from './defaults';
import {arrangeThemes, parseThemeList, readThemes} from './themeFiles';

/** A settings file that could not be read, and why. */
export interface SettingsProblem {
  readonly file: string;
  readonly error: FileError;
}

function defaultDocument(name: SettingsName): SettingsDocument {
  const parsed = parseSettingsDocument({
    name,
    value: {
      format: settingsCodecs[name].format,
      schemaVersion: 1,
      ...settingsDefaults[name],
    },
    access: 'editable',
    revision: 1,
  });
  if (!parsed.ok) {
    throw new Error(`Invalid defaults for ${name}: ${parsed.error.message}`);
  }
  return parsed.value;
}

function asProblem(file: string, error: unknown): SettingsProblem {
  const message = error instanceof Error ? error.message : String(error);
  return {
    file: basename(file),
    error: {kind: 'invalid', file, field: '', message},
  };
}

function addDefaultVerseLabel(document: SettingsDocument): SettingsDocument {
  if (
    document.name !== 'labels' ||
    document.access !== 'editable' ||
    document.value.defaultVerseLabelVersion !== undefined
  ) {
    return document;
  }
  const labels = [...document.value.labels];
  if (!labels.some(label => label.name === DEFAULT_VERSE_LABEL.name)) {
    const firstVerse = labels.findIndex(label => label.name === '1절');
    labels.splice(
      firstVerse < 0 ? labels.length : firstVerse,
      0,
      DEFAULT_VERSE_LABEL,
    );
  }
  return {
    ...document,
    value: {...document.value, labels, defaultVerseLabelVersion: 1},
  };
}

/** The themes: their list, and a file for each one the operator made. */
async function loadThemes(
  locations: DataLocations,
): Promise<LoadedSettingsArea> {
  const location = settingsLocation(locations, 'themes');
  const list = await readSettingsFile(location, parseThemeList);
  const own = await readThemes(locations.settings);
  const [error] = [...list.problems, ...own.problems];
  const fallback = defaultDocument('themes');
  const document: SettingsDocument = {
    name: 'themes',
    revision: fallback.revision,
    access: list.problems.some(problem => problem.kind === 'newer')
      ? 'readOnly'
      : 'editable',
    value: {
      format: 'llsettings.themes',
      schemaVersion: list.data?.schemaVersion ?? 1,
      defaults: list.data?.defaults ?? {},
      titles: list.data?.titles ?? [],
      themes: arrangeThemes(own.themes, list.data?.order ?? []),
    },
  };
  return {
    document,
    problem: error === undefined ? null : {file: basename(error.file), error},
  };
}

interface LoadedSettingsArea {
  readonly document: SettingsDocument | null;
  readonly problem: SettingsProblem | null;
}

/** Loads one area, preserving a failed file while its defaults keep the other areas usable. */
export async function loadSettingsArea(
  name: SettingsName,
  locations: DataLocations,
  saver: Pick<Saver, 'save'>,
): Promise<LoadedSettingsArea> {
  if (name === 'themes') return loadThemes(locations);
  const location = settingsLocation(locations, name);
  const codec = settingsCodecs[name];
  let fallback: SettingsDocument | null = null;
  let access: FileAccess = 'editable';
  try {
    fallback = defaultDocument(name);
    // NOTE(0913vision): Nest the loaded metadata so the file reader's data unwrap retains access.
    const read = await readSettingsFile<LoadedFile<SettingsValue>>(
      location,
      (text, file) => {
        const parsed = codec.parse(text, file);
        return parsed.ok
          ? {ok: true, value: {...parsed.value, data: parsed.value}}
          : parsed;
      },
    );
    access = read.problems.some(problem => problem.kind === 'newer')
      ? 'readOnly'
      : (read.data?.access ?? access);
    const loaded = read.data;
    const parsed =
      loaded === null
        ? ({ok: true, value: {...fallback, access}} as const)
        : parseSettingsDocument({
            name,
            value: loaded.data,
            access,
            revision: 1,
          });
    if (!parsed.ok) throw new Error(parsed.error.message);
    const [error] = read.problems;
    if (error !== undefined) {
      fallback = parsed.value;
      return {
        document: parsed.value,
        problem: {file: basename(location.file), error},
      };
    }
    const updated = addDefaultVerseLabel(parsed.value);
    fallback = updated;
    if (loaded === null || updated !== parsed.value) {
      const text = codec.serialize(updated.value, location.file);
      if (!text.ok) {
        return {
          document: fallback,
          problem: {file: basename(location.file), error: text.error},
        };
      }
      const saved = await saver.save({
        target: {file: location.file, kind: 'settings', id: name},
        text: text.value,
      });
      if (!saved.ok) {
        return {
          document: fallback,
          problem: asProblem(location.file, saved.error.message),
        };
      }
    }
    return {document: updated, problem: null};
  } catch (error: unknown) {
    return {
      document: fallback === null ? null : {...fallback, access},
      problem: asProblem(location.file, error),
    };
  }
}
