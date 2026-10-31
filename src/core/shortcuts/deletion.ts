import type {SettingsDocument, SettingsName} from '../schema/settingsDocuments';

function objectCommands(document: SettingsDocument): readonly string[] {
  switch (document.name) {
    case 'macros':
      return document.value.macros.map(item => `macro.${item.id}`);
    case 'looks':
      return document.value.looks.map(item => `look.${item.id}`);
    case 'themes':
      return document.value.themes.map(item => `theme.${item.id}`);
    case 'props':
      return document.value.props.map(item => `prop.${item.id}`);
    case 'quick':
      return document.value.items.map(item => `quick.${item.id}`);
    case 'timers':
      return document.value.timers.flatMap(item => [
        `timer.${item.id}.toggle`,
        `timer.${item.id}.reset`,
      ]);
    case 'screens':
      return document.value.screens.flatMap(item => [
        `output.screen.${item.id}`,
        `preview.focus.${item.id}`,
      ]);
    case 'bible':
    case 'labels':
    case 'messages':
    case 'notices':
    case 'preferences':
    case 'shortcuts':
    case 'stage-layouts':
      return [];
  }
}

/** Removes only bindings belonging to objects actually deleted by this edit. */
export function deletedObjectShortcuts(
  current: ReadonlyMap<SettingsName, SettingsDocument>,
  next: readonly SettingsDocument[],
): Extract<SettingsDocument, {name: 'shortcuts'}> | null {
  const shortcuts =
    next.find(document => document.name === 'shortcuts') ??
    current.get('shortcuts');
  if (shortcuts?.name !== 'shortcuts' || shortcuts.access !== 'editable') {
    return null;
  }
  const removed = new Set<string>();
  for (const document of next) {
    const previous = current.get(document.name);
    if (previous === undefined) continue;
    const kept = new Set(objectCommands(document));
    for (const id of objectCommands(previous)) {
      if (!kept.has(id)) removed.add(id);
    }
  }
  const entries = Object.entries(shortcuts.value.bindings);
  const kept = entries.filter(([id]) => !removed.has(id));
  if (kept.length === entries.length) return null;
  return {
    ...shortcuts,
    revision: shortcuts.revision + 1,
    value: {...shortcuts.value, bindings: Object.fromEntries(kept)},
  };
}
