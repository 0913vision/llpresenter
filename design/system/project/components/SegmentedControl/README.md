# SegmentedControl

A control that lines up two or three segments in a sunken track and picks one. Use it when there are few choices and all of them must be visible, such as the 구성 (arrangement) of a song, the output mode, the screen to preview, or a view switch.

## Where to use

- Panel headers and caption rows: 구성 (기본, 주일용, 짧게), the screen in the preview (본 화면 (main screen), 무대 (stage), 방송 자막 (broadcast captions)), output preview (화면 내용, 테스트 패턴)
- Property fields (fill variant): 종류 (type) and 방식 (mode) in 화면 설정 (Screen settings), 끝나면 (when done) and 맞춤 (fit) in media, 보여 줄 것 (what to show) in the stage layout, 채널 (channel) in Preferences
- Filters above a list: 전체, 바꾼 것, 겹침 in shortcuts (with counts)
- View switches (icon segments): 진행 도구 (show tools) and macros, grid view and list view in media, alignment in Look

## Where not to use

- More than five choices, or long names: use Select.
- A single on/off choice: Switch or IconButton (`aria-pressed`).
- Tabs in panel headers (예배 순서 (service order), 표시 중 …): use panel tabs. Use segments only for small switches that change the content inside a panel.
- Switching workspaces (진행 (Show), 준비 (Prep), 화면 설정): the workspace tabs of ToolbarButton.

## Anatomy

- Track: background `bg-well`, corner radius `radius-lg` (5px), padding `space-2`, height `size-control-sm` (26px). No gap between segments.
- Segment: height `size-control-xs` (22px), horizontal padding `space-10`, corner radius `radius-sm` (3px), text `label` (14/20).
- Selected segment: background `bg-control-hover`, text `text`. Other segments: no background, text `text-3`. Don't change the weight.
- Icon segment: 22×28, icon `size-icon-14`, name in `aria-label` and the tooltip.
- Count: `space-6` after the name, text `caption` (14/20), tabular numbers. `text-3` in unselected segments, `text-2` in the selected segment, and `warning` for a count of things that need fixing, such as conflicts. Don't make it a badge with a background.
- Fill variant (`ll-seg--fill`): width 100%, segments share the width equally, horizontal padding `space-8`. Truncate names that overflow with an ellipsis.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Default | Track `size-control-sm` 26, segment `size-control-xs` 22 | `label` | Panel headers, caption rows, filters above lists |
| Fill | Same | `label` | Property fields, Preferences rows |
| Icon | Same, segment width 28 | Icon 14 | Grid and list view, alignment |

There is one size. Next to md 30 controls (Preferences), use the 26 track too and center it vertically.

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default (not selected) | None | `text-3` | |
| Hover | `bg-raised` | `text-2` | 100ms ease-out |
| Pressed | `bg-control-hover` | `text-2` | Becomes the selected segment on release |
| Selected | `bg-control-hover` | `text` | Stays the same on hover |
| Focus | Unchanged | Unchanged | `outline: 2px solid accent`, offset 1px, on the segment, on keyboard focus only |
| Disabled | Only the selected segment keeps `bg-control-hover` | `text-off` | No hover. Give the reason in a tooltip |

## Behavior

- Build a group that picks one value with `role="radiogroup"`, and its segments with `role="radio"` + `aria-checked`. Use `role="tablist"` and `role="tab"` + `aria-selected` for screen tabs that change the content inside a panel, and `aria-pressed` for view switches. The CSS accepts all three.
- Keyboard: Tab moves focus to the selected segment (the others have `tabindex="-1"`). Left and Right arrows move to the next segment and select it at once, and wrap from the end to the start. Home and End go to the first and the last segment.
- Mouse: a click selects at once. A click on the segment that is already selected changes nothing.
- Name the group with `aria-label` (구성, 방식, 보기). If a visible label comes before it, connect it with `aria-labelledby`.
- When the whole group is disabled, give each segment `aria-disabled="true"`.

## Writing

- Write segment names as nouns of one or two words, in the same form as each other: 기본, 주일용, 짧게 / 맞추기, 채우기, 늘리기 / 전체 화면, 창, 캡처용 창, NDI.
- Don't put a description above the group. If the meaning of a segment is hard to follow, put it in a tooltip.
- Name an icon segment by what it switches to, such as "격자 보기" (grid view) and "목록 보기" (list view).

## Implementation notes

```jsx
<SegmentedControl label="구성" value={arr} onChange={setArr}
  options={[{ value: 'base', label: '기본' }, { value: 'sunday', label: '주일용' }, { value: 'short', label: '짧게' }]} />
<SegmentedControl label="방식" fill value={mode} onChange={setMode} options={modes} />
<SegmentedControl label="보기" kind="toggle" value={view} onChange={setView}
  options={[{ value: 'grid', icon: 'grid', label: '격자 보기' }, { value: 'list', icon: 'rows', label: '목록 보기' }]} />
<SegmentedControl label="보기" value={filter} onChange={setFilter}
  options={[{ value: 'all', label: '전체' }, { value: 'changed', label: '바꾼 것', count: 3 }, { value: 'conflict', label: '겹침', count: 1, warning: true }]} />
```

- props: `options` (`value`, `label`, `icon`, `count`, `warning`, `disabled`), `value`, `onChange`, `label` (group name), `fill`, `kind` `'radio'` (default) | `'tabs'` | `'toggle'`, `disabled`.
- Classes: track `ll-seg`, fill `ll-seg--fill`, segment `ll-seg__item`, icon segment `ll-seg__item--icon`, name `ll-seg__label` (wraps the name when it needs truncating), count `ll-seg__count`, warning count `ll-seg__count--warning`.

## Changes from the drafts

- Reflow, ImportSave: 구성 (기본, 주일용, 짧게) segments 24px with horizontal padding 12 → 22px with horizontal padding 10 (track 28 → 26).
- Screens (종류, 방식), Media (끝나면, 맞춤), StageEditor (보여 줄 것), Prefs (채널): fill segments 24px → 22px (track 28 → 26), horizontal padding 0 → 8.
- StageEditor: property tabs (26px segments in a track, the selected segment in bold) → 22px segments, weight fixed at 400.
- StageEditor, Looks: alignment icon segments with minimum width 32 and height 24 → 22×28, icon 14.
- Prefs, Shortcuts: filter segments 26px → 22px. Count badge (16px round chip, background #2a2a2a and #4a3410 for conflicts, 10px 700) → 11px number with no background (`text-3`, `warning` for conflicts).
