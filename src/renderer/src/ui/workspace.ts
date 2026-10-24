/**
 * The workspace that a 장 grid or a list sits in, which decides the keys it
 * keeps. In 진행 (`show`), the 장 grid and the 예배 순서 list keep ↑, ↓, and
 * Enter (the list also Home and End) and pass ←, →, Space, Page Up, and Page
 * Down on to 다음 장 and 이전 장 (docs/spec/10-shortcuts-and-settings.md,
 * rule 5). Everywhere else (`prep`), they keep the keys of their README.
 */
export type Workspace = 'show' | 'prep';
