/** Returns keyboard control to the live slide grid after a successful output. */
export function focusSlideGrid(): void {
  document
    .querySelector<HTMLElement>(
      '[data-show-slide-grid="true"] [role="listbox"]',
    )
    ?.focus({preventScroll: true});
}
