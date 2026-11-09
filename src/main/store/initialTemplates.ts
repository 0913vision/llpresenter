import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {FileError} from '@core/schema/fileFormat';
import {serializeTemplate} from '@core/schema/service';
import {sundayTemplate} from '@core/services/sundayTemplate';
import type {DataLocations} from './locations';

/** Seeds the default only when its templates folder does not exist yet. */
export async function initialTemplates(
  locations: DataLocations,
): Promise<FileError | null> {
  let file = locations.templates;
  try {
    const created = await mkdir(locations.templates, {recursive: true});
    if (created === undefined) return null;
    const template = sundayTemplate();
    file = join(locations.templates, `${template.id}.llservice`);
    const text = serializeTemplate(template, file);
    if (!text.ok) return text.error;
    await writeFile(file, text.value, {flag: 'wx'});
    return null;
  } catch (error: unknown) {
    return {
      kind: 'invalid',
      file,
      field: '',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
