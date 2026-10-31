import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export const SHORTCUT_SERVICE = '44000000-0000-4000-8000-000000000011';
export const SHORTCUT_SONG = '44000000-0000-4000-8000-000000000012';
export const SHORTCUT_ITEM = '44000000-0000-4000-8000-000000000013';
export const SHORTCUT_MACRO = '44000000-0000-4000-8000-000000000014';

/** Seeds a real settings file and enough slides to observe successive commands. */
export async function seedShortcutData(data: string): Promise<void> {
  const root = join(data, 'LoveLight');
  for (const folder of ['Songs', 'Services', 'Settings']) {
    await mkdir(join(root, folder), {recursive: true});
  }
  const files = [
    [
      join(data, 'app.json'),
      {format: 'llapp', schemaVersion: 1, lastServiceId: SHORTCUT_SERVICE},
    ],
    [
      join(root, 'Songs', `${SHORTCUT_SONG}.llsong`),
      {
        format: 'llsong',
        schemaVersion: 1,
        id: SHORTCUT_SONG,
        title: '단축키 점검 곡',
        slides: Array.from({length: 4}, (_, index) => ({
          label: `${index + 1}절`,
          lines: [`창작 점검 문장 ${index + 1}`],
        })),
        arrangements: [],
      },
    ],
    [
      join(root, 'Services', `${SHORTCUT_SERVICE}.llservice`),
      {
        format: 'llservice',
        schemaVersion: 1,
        id: SHORTCUT_SERVICE,
        name: '단축키 점검 예배',
        date: '2026-10-31T11:00',
        order: [{id: SHORTCUT_ITEM, song: SHORTCUT_SONG}],
      },
    ],
    [
      join(root, 'Settings', 'shortcuts.json'),
      {
        format: 'llsettings.shortcuts',
        schemaVersion: 1,
        bindings: {
          [`macro.${SHORTCUT_MACRO}`]: [{code: 'KeyU', mods: ['ctrl', 'alt']}],
          'clear.slide': [{code: 'F8', mods: []}],
          'show.next': [{code: 'F9', mods: []}],
          'workspace.prep': [{code: 'Digit9', mods: ['ctrl', 'alt']}],
          'workspace.show': [{code: 'Digit8', mods: ['ctrl', 'alt']}],
          'search.focus': [{code: 'KeyK', mods: ['ctrl', 'alt']}],
          'ui.zoomIn': [{code: 'Equal', mods: ['ctrl', 'alt']}],
          'service.new': [{code: 'KeyN', mods: ['ctrl', 'alt']}],
          'editor.splitSlide': [{code: 'Enter', mods: ['ctrl', 'alt']}],
          'tools.messages': [{code: 'KeyM', mods: ['ctrl', 'alt']}],
          'workspace.screens': [{code: 'KeyH', mods: []}],
          'future.command': [{code: 'KeyW', mods: ['ctrl', 'alt']}],
        },
      },
    ],
    [
      join(root, 'Settings', 'macros.json'),
      {
        format: 'llsettings.macros',
        schemaVersion: 1,
        macros: [
          {
            id: SHORTCUT_MACRO,
            name: '단축키 점검',
            icon: 'macro',
            color: 'teal',
            actions: [{kind: 'clearLayer', layer: 'audio'}],
          },
        ],
        collections: [],
      },
    ],
  ] as const;
  await Promise.all(
    files.map(([file, value]) =>
      writeFile(file, JSON.stringify(value), 'utf8'),
    ),
  );
}
