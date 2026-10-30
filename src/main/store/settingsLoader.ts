import {basename} from 'node:path';
import type {FileAccess, FileError, LoadedFile} from '@core/schema/fileFormat';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import type {DataLocations} from './locations';
import type {Saver} from './saver';
import {settingsCodecs, type SettingsValue} from './settingsCodecs';
import {settingsDefaults} from './settingsDefaults';
import {readSettingsFile, settingsLocation} from './settingsFile';

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

/** Loads one area, preserving a failed file while its defaults keep the other areas usable. */
export async function loadSettingsArea(
  name: SettingsName,
  locations: DataLocations,
  saver: Saver,
): Promise<{
  readonly document: SettingsDocument | null;
  readonly problem: SettingsProblem | null;
}> {
  const location = settingsLocation(locations, name);
  const codec = settingsCodecs[name];
  let fallback: SettingsDocument | null = null;
  let access: FileAccess = 'editable';
  try {
    fallback = defaultDocument(name);
    // NOTE(0913vision): Nest the loaded metadata so the M2 reader's data unwrap retains access.
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
      return {
        document: parsed.value,
        problem: {file: basename(location.file), error},
      };
    }
    if (loaded === null) {
      const text = codec.serialize(parsed.value.value, location.file);
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
    return {document: parsed.value, problem: null};
  } catch (error: unknown) {
    return {
      document: fallback === null ? null : {...fallback, access},
      problem: asProblem(location.file, error),
    };
  }
}
