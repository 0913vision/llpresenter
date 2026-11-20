/** Service files retain legacy times; service ordering uses only the date. */
export function serviceDay(date: string): string {
  return date.slice(0, 10);
}
