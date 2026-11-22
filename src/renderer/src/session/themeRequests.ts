import {create} from 'zustand';
import type {ThemeId} from '@core/schema/ids';

/** The theme that the 테마 workspace opens next. */
export const useThemeRequest = create<{readonly theme: ThemeId | null}>(() => ({
  theme: null,
}));

/** Asks the 테마 workspace to show a theme. */
export function openTheme(theme: ThemeId): void {
  useThemeRequest.setState({theme});
}

/** Takes the request, so the workspace answers it once. */
export function takeThemeRequest(): ThemeId | null {
  const {theme} = useThemeRequest.getState();
  if (theme !== null) useThemeRequest.setState({theme: null});
  return theme;
}
