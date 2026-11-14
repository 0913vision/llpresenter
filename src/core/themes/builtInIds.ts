const builtInThemeNumbers = [
  101, 102, 104, 105, 106, 107, 110, 111, 120, 121, 122, 123, 124, 125, 371,
  398,
];

const builtInThemeIds = new Set(
  builtInThemeNumbers.map(
    number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  ),
);

export function isBuiltInThemeId(id: string): boolean {
  return builtInThemeIds.has(id);
}

export function userThemeCount(
  themes: ReadonlyArray<{readonly id: string}>,
): number {
  return themes.filter(theme => !isBuiltInThemeId(theme.id)).length;
}
