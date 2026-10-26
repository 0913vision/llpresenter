import type {LookId} from '@shared/schema/ids';
import type {NamedDocument} from './useSettingsDocument';

type LooksFile = NamedDocument<'looks'>['value'];
type ScreensFile = NamedDocument<'screens'>['value'];

/** A Look or a stage layout as a list row shows it. */
export interface Choice {
  readonly id: string;
  readonly name: string;
}

/** The Look on output: the selected one, or the saved current Look. */
export function lookInUse(
  looks: LooksFile,
  liveLookId: LookId | null | undefined,
): LookId {
  return liveLookId ?? looks.current;
}

/**
 * The stage layouts that the Look in use gives the 무대 screens. The Look's
 * 무대 화면 card is the base layout (docs/spec/03, "Which stage layout
 * applies").
 */
export function stageLayoutsInUse(
  looks: LooksFile,
  screens: ScreensFile,
  liveLookId: LookId | null | undefined,
): ReadonlySet<string> {
  const lookId = lookInUse(looks, liveLookId);
  const look = looks.looks.find(entry => entry.id === lookId);
  const used = new Set<string>();
  if (look === undefined) return used;
  for (const screen of screens.screens) {
    const layout =
      screen.kind === 'stage' ? look.screens[screen.id] : undefined;
    if (layout?.stageLayout !== undefined) used.add(layout.stageLayout);
  }
  return used;
}
