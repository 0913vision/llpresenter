import {create} from 'zustand';
import type {Notice} from '@renderer/ui/notices';

/** An unresolved output warning and the screen it belongs to. */
export interface OutputWarning {
  readonly screenId: string;
  /** The full screen name, such as 무대 화면. */
  readonly screenName: string;
  readonly notice: Notice;
}

interface OutputWarnings {
  /** By notice key, in the order they came. */
  readonly warnings: ReadonlyMap<string, OutputWarning>;
}

/**
 * The output warnings that still hold, whether or not their cards show, so a
 * closed card can be shown again from the 출력 menu (spec 08).
 */
export const useOutputWarnings = create<OutputWarnings>(() => ({
  warnings: new Map(),
}));

export function keepOutputWarning(warning: OutputWarning): void {
  useOutputWarnings.setState(({warnings}) => ({
    warnings: new Map(warnings).set(warning.notice.key, warning),
  }));
}

export function dropOutputWarning(key: string): void {
  const {warnings} = useOutputWarnings.getState();
  if (!warnings.has(key)) return;
  const next = new Map(warnings);
  next.delete(key);
  useOutputWarnings.setState({warnings: next});
}

/** The cards of one screen's unresolved warnings. */
export function outputWarningCards(screenId: string): readonly Notice[] {
  return [...useOutputWarnings.getState().warnings.values()]
    .filter(warning => warning.screenId === screenId)
    .map(warning => warning.notice);
}

/** The screens with an unresolved warning, once each, in the order they came. */
export function warningScreens(
  warnings: ReadonlyMap<string, OutputWarning>,
): ReadonlyArray<Pick<OutputWarning, 'screenId' | 'screenName'>> {
  const screens = new Map<string, string>();
  for (const {screenId, screenName} of warnings.values()) {
    if (!screens.has(screenId)) screens.set(screenId, screenName);
  }
  return [...screens].map(([screenId, screenName]) => ({screenId, screenName}));
}
