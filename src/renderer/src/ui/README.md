# ui

This folder holds the design system components. Follow
`design/system/project/components/<name>/README.md` exactly for appearance,
size, states, and behavior, and write values only as token variables. Don't
change the shared parts in this folder without the lead's approval.

- Available now: `Icon` (86 Phosphor Regular icons in `icons/`; the MIT license
  is in `icons/LICENSE-phosphor.txt`).
- To build in phase 1: `Button`, `IconButton`, `SegmentedControl`, `TextField`,
  `Select`, `Checkbox`, `Switch`, `Slider`, `Menu`, `Tooltip`, `Dialog`,
  `AlertDialog`, `Panel`, `ListRow`, `StatusMarks`, `MenuBar`, `Toolbar`,
  `ToolbarButton`, `StatusBar`.

## Empty list or grid

`EmptyState` is what a panel body shows with no rows. The rule is the "Empty
state" section of `design/system/project/components/Panel/README.md`: one short
line in `text-3`, centered, in the app's words, plus one button only when an
obvious next action already exists. Show it only after a successful read.
