import {
  createContext,
  useContext,
  useMemo,
  type JSX,
  type ReactNode,
} from 'react';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import type {Notice} from '@renderer/ui/notices';
import {summarizeScreens, type ScreenSummary} from './screens';

const noScreens: readonly ScreenSummary[] = [];

/** The shell's screen document projection, also usable by isolated views. */
export const ScreenSummariesContext = createContext(noScreens);

/** Shares one revision-guarded settings read/subscription across shell consumers. */
export function ScreenSummariesProvider({
  children,
  onProblem,
}: {
  readonly children: ReactNode;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const document = useSettingsDocument('screens', '화면', onProblem);
  const screens = useMemo(
    () =>
      document === null ? noScreens : summarizeScreens(document.value.screens),
    [document],
  );
  return (
    <ScreenSummariesContext value={screens}>{children}</ScreenSummariesContext>
  );
}

/** Current screen names and destinations; empty before a successful settings read. */
export function useScreenSummaries(): readonly ScreenSummary[] {
  return useContext(ScreenSummariesContext);
}
