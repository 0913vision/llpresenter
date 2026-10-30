export function nextTimerName(names: Iterable<string>): string {
  const used = new Set(names);
  let number = 1;
  while (used.has(`타이머 ${number}`)) number++;
  return `타이머 ${number}`;
}
