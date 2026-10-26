# StatusMarks

Four small marks: the LIVE badge, the status dot, the count badge, and the progress bar. Put them inside other components to report live state, connection state, counts, and progress.

## Where to use

- LIVE badge `ll-badge ll-badge--live`: the right end of a list row that is live now ("만복의 근원 하나님" in the 예배 순서 (service order)).
- Status dot `ll-dot`: the output state in the status bar (본 화면 (main screen) 60fps), the top right of the toolbar output button icon (`ll-dot--cut`), and the NDI connection in 화면 설정 (Screen settings).
- Count badge `ll-count`: the count after a panel tab name (진행 도구 (show tools) "표시 중 3").
- Progress bar `ll-progress`: tasks that have an end, such as media copying (Media) and importing. `ll-progress--playback` is the playback position of audio and video.

## Where not to use

- Text chips that describe a state ("출력 중", "정지 화면", "파일 없음"): don't make them (rule 18). Live state is a red ring or the LIVE badge, a warning is an orange icon or outline, and the reason goes in a tooltip.
- Live marks on thumbnails, media tiles, and chips: use that component's `ring-live`. Don't add a LIVE badge on top of it.
- A status dot in front of a list row: use the LIVE badge.
- A playback position that you drag to change (time bar handle): use Slider.

## Anatomy

- LIVE badge: height `size-badge` (22px), horizontal padding `space-4`, corner radius `radius-sm`, background `live`, text `text-on-fill` `micro` (14/20/400), letter spacing 0.04em. The text is only the uppercase English word "LIVE".
- Status dot: 6×6, `radius-full`. `ll-dot--ok` (`ok`), `--warning` (`warning`), `--live` (`live`), `--off` (`line-strong`). On top of an icon, add `ring-dot-cut` (2px `bg-app`) with `ll-dot--cut`, and let the parent set the position (right −4, top −3 for an 18px icon). Next to text, gap `space-6`.
- Count badge: height 22, minimum width 22, horizontal padding `space-4`, corner radius `radius-sm`, background `selection`, text `text-on-selection` `caption-strong` (16/22/600), tabular-nums. Gap from the tab name `space-6` (set by the tab).
- Progress bar: height 4, corner radius `radius-xs`, track `line-strong`, bar `ll-progress__bar` in `accent` (`text` for a playback position). Set the length with the bar's `width` (%).

## Sizes and variants

| Name | Height | Text | Where to use |
|---|---|---|---|
| `ll-badge--live` | 22 | `micro` | List rows |
| `ll-dot` | 6 | None | Status bar, toolbar output buttons, NDI |
| `ll-dot--cut` | 6 + 2px ring | None | On top of icons |
| `ll-count` | 22 | `caption-strong` | Panel tabs |
| `ll-progress` | 4 | None | Copying, importing |
| `ll-progress--playback` | 4 | None | Audio and video playback position (display only) |

## States

| State | Background | Text and icon | Other |
|---|---|---|---|
| Badge: live | `live` | `text-on-fill` | Same on a selected row (`selection`) |
| Dot: healthy | `ok` | | Use `ok` only for the dot |
| Dot: warning | `warning` | Text next to it is also `warning` | Reason in a tooltip |
| Dot: live (on) | `live` | | Toolbar output button |
| Dot: off | `line-strong` | Button text `text-off` | Toolbar output button |
| Count: 0 | Hidden | | Hide the badge at 0 |
| Bar: 0–100% | `accent` on `line-strong` | | Remove the bar when the task ends |

## Behavior

- Badges and dots are information, not decoration, so give them a readable name. The badge text is read as it is. For a dot, give the name to the parent (for example, the output button `aria-label="본 화면 출력 켜짐"`, or the status bar item title "모니터 3 연결 끊김, 창으로 표시 중"). The dot itself is `aria-hidden="true"`.
- So that the count badge is read together with the tab name, set the tab's `aria-label` to "표시 중 3개".
- The progress bar is `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow`, with the task name as the `aria-label` ("부활절 배경.mp4 복사"). A playback position uses `aria-valuetext="1:24 / 3:42"`.
- Don't animate changes in bar length (draw the value as received, at once).

## Writing

- Write only "LIVE" in the badge. Don't make other badges.
- Write only the number in the count badge. Above 99, write "99+".
- Next to a dot, write only the screen name and the value ("본 화면 60fps"). Don't add words such as "정상" (healthy) or "연결됨" (connected).

## Implementation notes

- `<LiveBadge />`, `<StatusDot tone="ok|warning|live|off" cut />`, `<CountBadge value={3} />`, `<Progress value={62} variant="task|playback" label="부활절 배경.mp4 복사" />`
- Classes (other components use these names as they are): `ll-badge ll-badge--live`, `ll-dot ll-dot--ok|--warning|--live|--off`, `ll-dot--cut`, `ll-count`, `ll-progress` + `ll-progress__bar`, `ll-progress--playback`.

## Changes from the drafts

- ShowH, Problems 예배 순서 LIVE badge: horizontal padding 5 → `space-4`. Compact: 15px, 9px, horizontal padding 4 → 16px, 10px (`micro`).
- ShowH, PrepService, Media toolbar output button dot 7px → 6px.
- ShowH, Compact, Overlays, Macros tab counts: 16px round pill #3a3a3a with #ececec 10px text → 18px `radius-sm` `selection` with `text-on-selection` 11px 600 text.
- Compact 진행 도구: the count pill (5) after "더 보기" (more) is removed.
- Media copy bar #3d8bf0 on 3px #2b2b2b → `accent` on 4px `line-strong`, `radius-xs`. Playback position bar in the Overlays audio tab (#ececec on #3a3a3a, radius 2) → `ll-progress--playback` (the same values as tokens). The range bar in the Media property panel has handles, so it isn't this component.
