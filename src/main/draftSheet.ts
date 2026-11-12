import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ipcMain} from 'electron';

export function registerDraftSheet(): void {
  const mode = process.env['LLP_DRAFT_SHEET'];
  const directory = process.env['LLP_DRAFT_SHEET_DIR'];
  let data: unknown = null;
  if (
    (mode === 'chords' || mode === 'staff' || mode === 'staff-next') &&
    directory
  ) {
    try {
      const slides: unknown = JSON.parse(
        readFileSync(join(directory, 'slides.json'), 'utf8'),
      );
      data = {
        mode,
        xml: readFileSync(join(directory, 'amazing-grace-ko.musicxml'), 'utf8'),
        slides,
      };
    } catch (error) {
      console.error('Could not load draft sheet music', error);
    }
  }
  ipcMain.handle('draft-sheet:read', () => data);
}
