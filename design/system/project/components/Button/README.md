# Button

A command button with a text label. Use it in the footers of dialogs and confirmation dialogs, in Preferences, and for small actions in panels.

## Where to use

- Footers of dialogs and confirmation dialogs: [취소] … [새 곡으로 저장] [덮어쓰기], [새로 시작] [복구하고 시작] (md)
- Actions at the end of Preferences rows: 지금 백업, 지금 확인, 바꾸기, 기본값으로, 모두 기본값으로 (md)
- Actions in panel headers and caption rows: 라이브러리 곡 편집, 가져오기, 버리기, 저장 (sm)
- Less important commands that add an item at the end of a list: 역본 추가, 지금 예배를 템플릿으로 저장 (ghost)

## Where not to use

- A dropdown that picks a value (a button with an arrow to the right of its text): use Select.
- An icon-only button: IconButton. A toolbar button with its name under the icon: ToolbarButton. The 지우기 (clear) row in the 진행 (Show) workspace: ClearButton.
- A group that picks one of several values: SegmentedControl.
- Status: don't show a live or warning state with the button color. Don't make red, orange, or green buttons. Keep a command that can't be undone, such as 지우기, a secondary button too, and ask in a confirmation dialog.

## Anatomy

- Background: secondary `bg-control`, primary `accent-fill`, ghost none. Corner radius `radius-md` (4px). No border or shadow.
- sm: height `size-control-sm` (26px), text `label` (14/20), horizontal padding `space-10`. With a leading icon, the left padding alone is `space-8`, the icon is `size-icon-14`, and the gap between the icon and the text is `space-6`.
- md: height `size-control-md` (30px), text `body` (16/22), horizontal padding `space-14`. With a leading icon, the left padding alone is `space-12`, the icon is `size-icon-16`, and the gap is `space-8`.
- Primary button text has weight 600 (sm `label-strong`, md `body-strong`).
- Icons follow the text color: secondary `text`, primary `text-on-fill`, ghost `text-2`.
- The width fits the text. Don't set a minimum width, and don't wrap the text.
- The gap between buttons is `space-8`.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| Primary md | `size-control-md` 30 | `body-strong`, `text-on-fill` | Far right of dialog and confirmation dialog footers. One per window |
| Primary sm | `size-control-sm` 26 | `label-strong`, `text-on-fill` | The command that finishes the work in that part of a panel (saving an imported song) |
| Secondary md | 30 | `body`, `text` | Dialogs, confirmation dialogs, Preferences |
| Secondary sm | 26 | `label`, `text` | Panel headers, caption rows, property fields |
| Ghost md / sm | 30 / 26 | `body` / `label`, `text-2` | Commands that must draw less attention, such as adding at the end of a list |

## States

| State | Background | Text and icon | Other |
| --- | --- | --- | --- |
| Default | Secondary `bg-control`, primary `accent-fill`, ghost none | `text`, `text-on-fill`, `text-2` | |
| Hover | Secondary `bg-control-hover`, primary `accent-fill-hover`, ghost `bg-raised` | Unchanged | Background 100ms ease-out |
| Pressed | Secondary `bg-control-hover`, primary `accent-fill-hover`, ghost `bg-control-hover` | Ghost only changes to `text` | |
| Focus | Unchanged | Unchanged | `outline: 2px solid accent`, offset 1px, on keyboard focus only |
| Disabled | `bg-control` for both secondary and primary, ghost none | `text-off` | No hover or pressed state. Don't lower the opacity. Give the reason in a tooltip |

## Behavior

- Unmodified Enter and Space press the button. Modified activation keys pass to their owner without pressing it. In a dialog, Enter acts as the primary button and Esc acts as [취소] (Dialog handles this).
- The focus order is the visible order (left to right).
- Make a disabled button with `aria-disabled="true"` instead of `disabled`, and ignore presses. The button stays focusable and can show the reason in a tooltip. The CSS accepts both.
- Don't draw the focus ring on a mouse click (`:focus-visible` only).
- Icons are `aria-hidden`. The button text gives the name.
- Keep imported-song Save disabled while its song catalog is loading or unavailable; a missing catalog is not an empty library. Explain the reason in the tooltip, apply the same guard to Ctrl S and confirmation actions, and keep Discard available. The existing failure notice provides Retry; after recovery, the next explicit Save checks duplicates and previews the available title.

## Writing

- Name what happens with a verb: 만들기, 가져오기, 덮어쓰기, 새 곡으로 저장, 복구하고 시작, 바꾸기.
- Don't use "확인" (OK), "예" (Yes), or "아니요" (No). In a confirmation dialog too, name the action, as in [덮어쓰기]. The button that backs out is always "취소" (Cancel).
- Keep it short, two or three words. Don't put explanatory text next to a button. If you need it, put it in a tooltip.
- Don't add a period, an exclamation mark, or an ellipsis.

## Implementation notes

```jsx
<Button variant="secondary" size="sm" icon="edit">라이브러리 곡 편집</Button>
<Button size="md">취소</Button>
<Button variant="primary" size="md" onClick={overwrite}>덮어쓰기</Button>
<Button variant="ghost" size="md" icon="plus">역본 추가</Button>
<Button variant="primary" size="md" disabled title="곡 제목을 적어야 저장할 수 있습니다">저장</Button>
```

- props: `variant` `'secondary'` (default) | `'primary'` | `'ghost'`, `size` `'sm'` (default) | `'md'`, `icon` icon key (before the text), `disabled` (drawn with `aria-disabled`), `title` (tooltip text, drawn by Tooltip).
- Classes: `ll-btn`, variants `ll-btn--primary` `ll-btn--ghost`, size `ll-btn--md` (sm has no class), and `ll-btn--lead` when there is a leading icon. The icon is `<span class="ll-i ll-i-<key>" aria-hidden="true">`, and the button sets its size.
- `.ll-root button { font: inherit; color: inherit }` in `00-base.css` has specificity 0,1,1, so the block rule is raised one step to `.ll-root .ll-btn`, and variants to `.ll-btn.ll-btn--x`. Keep this order when you port the CSS.
- `.is-hover`, `.is-active`, and `.is-focus` pin a state in the previews. Don't use them in app code.

## Changes from the drafts

- All boards: primary button background #3d8bf0 → `accent-fill` (#2a70dc), hover of the same color → `accent-fill-hover`.
- NewService, ServiceImport: [취소] 12px → 13px (`body`), [만들기] [가져오기] 12px with horizontal padding 16 → 13px 600 with horizontal padding 14.
- ImportSave: background of [취소] [새 곡으로 저장] in the confirmation dialog #333333 → `bg-control`. [저장] in the panel: horizontal padding 14 → 10, 6px before it → `space-8` between buttons.
- ImportEdit: [저장] in the panel horizontal padding 14 → 10, [버리기] horizontal padding 12 → 10.
- ImportText: [편집] 32px with horizontal padding 18 → md 30 with horizontal padding 14.
- Recovery: [새로 시작] [복구하고 시작] height 32 → 30 (md), primary button horizontal padding 16 → 14.
- Prefs, Shortcuts: 28px buttons (바꾸기, 지금 백업, 지금 확인, 기본값으로, 지우기, 모두 기본값으로) 12px with horizontal padding 12 → md 30, 13px, horizontal padding 14 (with a leading icon, left 12 and icon 14 → 16). "역본 추가" 32px 12px → ghost md 30, 13px, icon 16.
- NewService: "지금 예배를 템플릿으로 저장" 32px 12px icon 14 → ghost md 30, 13px, icon 16.
- Overlays [보내기], Bible [바로 띄우기]: 30px primary button in the panel → sm 26 (12px 600, leading icon 14, left 8).
