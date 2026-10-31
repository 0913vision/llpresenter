let active = false;

export function setCommandDragActive(next: boolean): void {
  active = next;
}
export function isCommandDragActive(): boolean {
  return active;
}
