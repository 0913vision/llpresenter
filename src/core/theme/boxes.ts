import {freeName} from '../common/freeName';
import {
  THEME_FILE_LIMITS,
  type OwnThemeScreen,
  type SlidePurpose,
  type ThemeBox,
  type ThemeFile,
  type ThemeScreen,
} from '../schema/theme';
import {BUILT_IN_THEME_IDS} from './builtIn/ids';
import {AUTO_TOKENS} from './content';
import {removeElements} from './elements';
import {templateTokens} from './template';
import {builtInTheme} from './themes';

const NEW_BOX_NAME = '글 상자';

/** The boxes that the app itself puts texts in, for a purpose. */
export function appBoxes(purpose: SlidePurpose): ReadonlySet<string> {
  return new Set(
    builtInTheme(BUILT_IN_THEME_IDS[purpose])?.boxes.map(box => box.name),
  );
}

/** Every value the templates of a theme can use. */
export function themeValues({
  boxes,
}: Pick<ThemeFile, 'boxes'>): readonly string[] {
  return [
    ...new Set([...boxes.map(box => box.name), ...Object.values(AUTO_TOKENS)]),
  ];
}

/** Why a box can not have a name, or undefined when it can. */
export function boxNameProblem(
  {boxes}: Pick<ThemeFile, 'boxes'>,
  name: string,
  own?: string,
): 'empty' | 'brackets' | 'taken' | undefined {
  if (name.trim() === '') return 'empty';
  if (/[{}[\]]/u.test(name)) return 'brackets';
  return boxes.some(box => box.name === name && box.name !== own)
    ? 'taken'
    : undefined;
}

/** Each screen of a theme after a change of its own layouts. */
function mapScreens(
  theme: ThemeFile,
  change: (screen: OwnThemeScreen) => OwnThemeScreen,
): ThemeFile {
  const changed = (screen: ThemeScreen): ThemeScreen =>
    screen.mode === 'own' ? change(screen) : screen;
  const {audience, broadcast, stage} = theme.screens;
  return {
    ...theme,
    screens: {
      ...theme.screens,
      audience: changed(audience),
      broadcast: changed(broadcast),
      stage: changed(stage),
    },
    ...(theme.others === undefined
      ? {}
      : {
          others: Object.fromEntries(
            Object.entries(theme.others).map(([id, screen]) => [
              id,
              changed(screen),
            ]),
          ),
        }),
  };
}

/** Each template of a theme after a change; undefined leaves one out. */
function mapTemplates(
  theme: ThemeFile,
  change: (template: string) => string | undefined,
): ThemeFile {
  const all = (templates: readonly string[]): string[] =>
    templates.flatMap(template => change(template) ?? []);
  const {next} = theme;
  return mapScreens(
    {
      ...theme,
      next: {
        ...next,
        content: all(next.content),
        ...(next.atStart === undefined ? {} : {atStart: all(next.atStart)}),
      },
    },
    screen => ({
      ...screen,
      elements: screen.elements.map(element =>
        element.kind === 'text'
          ? {
              ...element,
              content: all(element.content),
              ...(element.empty === undefined
                ? {}
                : {
                    empty: {
                      ...element.empty,
                      content: all(element.empty.content),
                    },
                  }),
            }
          : element,
      ),
    }),
  );
}

/** Adds a box to a theme, with a name of its own. */
export function addBox(theme: ThemeFile): {
  readonly theme: ThemeFile;
  readonly box: ThemeBox;
} | null {
  if (theme.boxes.length >= THEME_FILE_LIMITS.boxes) return null;
  const box: ThemeBox = {
    name: freeName(NEW_BOX_NAME, new Set(theme.boxes.map(({name}) => name))),
    column: true,
    rows: 'many',
  };
  return {theme: {...theme, boxes: [...theme.boxes, box]}, box};
}

/** Changes a box; a new name is put into every text that shows the box. */
export function changeBox(
  theme: ThemeFile,
  name: string,
  change: (box: ThemeBox) => ThemeBox,
): ThemeFile {
  const box = theme.boxes.find(entry => entry.name === name);
  if (box === undefined) return theme;
  const changed = change(box);
  const renamed =
    changed.name === name
      ? theme
      : mapTemplates(theme, template =>
          template.replaceAll(`{${name}}`, `{${changed.name}}`),
        );
  return {
    ...renamed,
    boxes: renamed.boxes.map(entry => (entry.name === name ? changed : entry)),
  };
}

/** Moves a box to another place in the order of the columns. */
export function moveBox(
  theme: ThemeFile,
  name: string,
  step: -1 | 1,
): ThemeFile {
  const from = theme.boxes.findIndex(box => box.name === name);
  const box = theme.boxes[from];
  const other = theme.boxes[from + step];
  if (box === undefined || other === undefined) return theme;
  return {
    ...theme,
    boxes: theme.boxes.map((entry, index) =>
      index === from ? other : index === from + step ? box : entry,
    ),
  };
}

/** Takes a box away, with the texts that show nothing else. */
export function removeBox(theme: ThemeFile, name: string): ThemeFile {
  const without = mapTemplates(
    {...theme, boxes: theme.boxes.filter(box => box.name !== name)},
    template => (templateTokens([template]).has(name) ? undefined : template),
  );
  return mapScreens(without, screen =>
    removeElements(
      screen,
      new Set(
        screen.elements
          .filter(
            element => element.kind === 'text' && element.content.length === 0,
          )
          .map(element => element.id),
      ),
    ),
  );
}
