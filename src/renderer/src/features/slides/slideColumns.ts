import {create} from 'zustand';
import type {SlideColumns} from '@core/schema/slideColumns';
import type {ThemeFile} from '@core/schema/theme';
import type {UiState} from '@core/schema/uiState';
import {boxesOf, NEXT_BOX} from '@core/slides';

const useColumns = create<{readonly columns: SlideColumns}>(() => ({
  columns: {},
}));

/** Takes the columns that were switched on this computer before. */
export function seedSlideColumns(state: UiState): void {
  useColumns.setState({columns: state.slideColumns ?? {}});
}

function firstState(theme: ThemeFile, box: string): boolean {
  return box === NEXT_BOX
    ? theme.next.column
    : (theme.boxes.find(entry => entry.name === box)?.column ?? false);
}

/** The columns the list of slides shows for slides with a theme. */
export function shownColumns(
  theme: ThemeFile,
  columns: SlideColumns,
): readonly string[] {
  return boxesOf(theme).filter(
    box => columns[theme.id]?.[box] ?? firstState(theme, box),
  );
}

export function useSlideColumns(): SlideColumns {
  return useColumns(view => view.columns);
}

/** Shows or hides a column; what the theme says itself is not remembered. */
export function toggleColumn(theme: ThemeFile, box: string): void {
  const {columns} = useColumns.getState();
  const shown = columns[theme.id]?.[box] ?? firstState(theme, box);
  const {[box]: _box, ...others} = columns[theme.id] ?? {};
  const own =
    !shown === firstState(theme, box) ? others : {...others, [box]: !shown};
  const {[theme.id]: _theme, ...rest} = columns;
  const next: SlideColumns =
    Object.keys(own).length === 0 ? rest : {...rest, [theme.id]: own};
  useColumns.setState({columns: next});
  window.llp?.ui.setRememberedView({slideColumns: next});
}
