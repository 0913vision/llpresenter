# LabelColorPicker

A row of color swatches for picking the color of an 이름표 (label) or a macro. It goes inside the 이름표 menu in library song editing and inside the macro right-click menu.

## Where to use

- Library song editing (Reflow), imported song editing (ImportEdit): the color row (none + 8 colors) in the 이름표 menu that opens when you click the 이름표 chip of a block
- Macros: the "색" (color) row in the tile right-click menu (8 colors, no none)

## Where not to use

- Text color or background color inside an output screen: use the color field of the Look editor (16px sample + value). Those colors aren't 이름표 colors.
- The small 이름표 sample (18×12) in front of a menu item: that is `ll-menu__swatch` of `Menu`. It isn't a picker.

## Anatomy

- Row `ll-swatches`: lay the swatches side by side with no gap. The padding inside each swatch becomes the gap between colors (8px).
- Row inside a menu `ll-swatches--menu`: height `size-row-menu` (28), padding `space-2` `space-4`. The left edge of the first color lines up with the leading cell of the menu items (14px from the left).
- Name in front of the row `ll-swatches__label`: "색" in the macro menu. `body` (13/18) `text`, starting on the same line as the menu item text.
- Swatch `ll-swatch`: hit area 24×24, radius `radius-md`. Center color `ll-swatch__chip` 16×16, radius `radius-sm`.
- Colors: `label-teal` (청록), `label-green` (초록), `label-yellow` (노랑), `label-orange` (주황), `label-rose` (분홍), `label-violet` (보라), `label-slate` (남색), `label-gray` (회색). Place them in this order.
- None `ll-swatch--none`: background `label-none`, border `inset 0 0 0 1px` `line-control`, a 12px `x` in `text-2` in the center. Put it first in the row.
- Selected: a 2px `text` ring inside the swatch (`inset 0 0 0 2px`). The 2px between the color and the ring stays empty, so the ring shows on any color. Don't use `ring-selected` (blue), because it is hard to tell apart from slate and violet. Both drafts (Reflow, Macros) use a white ring.

## Sizes and variants

| Name | Height | Text | Where to use |
| --- | --- | --- | --- |
| 이름표 color row | 28 | - | 이름표 menu: none + 8 colors, 9 swatches, 216px |
| Macro color row | 28 | Leading name `body` 13/18 | Macro right-click menu: "색" + 8 colors |

## States

| State | Background (swatch) | Color | Other |
| --- | --- | --- | --- |
| Default | Transparent | 이름표 color | |
| Hover | `bg-control-hover` | Same | Same background as a menu item hover |
| Selected | Transparent | Same | 2px `text` ring inside, `aria-checked="true"` |
| Focus | Same | Same | outline 2px `accent`, offset 1px |
| Disabled | None | | When the color can't be changed, disable the chip or menu item that opens the menu instead |

## Behavior

- A click applies that color at once and leaves the menu open. Changing an 이름표 color changes the band color of every 슬라이드 (slide) that uses that 이름표.
- Keyboard: Tab enters the row once (focus on the selected color), and the left and right arrows move and select at once. Inside a menu, the up and down arrows move between menu items, and once focus reaches the color row, the left and right arrows move between colors.
- aria: the row has `role="radiogroup"` and an `aria-label` (for example, "후렴 색", "색"). Each swatch has `role="radio"`, `aria-checked`, and an `aria-label` (the color name: 청록, 초록, 노랑, 주황, 분홍, 보라, 남색, 회색, 없음).

## Writing

- Show color names only in tooltips and `aria-label`. Don't write color names next to the row.
- Use only the nine color names above. Don't mix in other names such as "파랑" or "하늘색".

## Implementation notes

- `<LabelColorPicker value="yellow" allowNone onChange aria-label="후렴 색" />`
- `<LabelColorPicker value="green" label="색" />` (macro: without `allowNone`)
- Markup: `div.ll-swatches[.ll-swatches--menu][role=radiogroup] > [span.ll-swatches__label] + button.ll-swatch.ll-swatch--<color>[role=radio][aria-checked] > span.ll-swatch__chip`. For none, put `span.ll-i.ll-i-x` inside the chip.
- To put the row in a menu, place it as is between the items and the divider (`ll-menu__sep`) of `Menu`.
- Classes: `ll-swatches`, `ll-swatches--menu`, `ll-swatches__label`, `ll-swatch`, `ll-swatch__chip`, `ll-swatch--none`, `ll-swatch--teal|green|yellow|orange|rose|violet|slate|gray`.

## Changes from the drafts

- Color row in the Reflow 이름표 menu: color 18 → 16, gap between swatches 4 → 0 (24px swatches touch), selected ring 2px outside the swatch → 2px inside the swatch, row padding 4 8 6 → 2 4, none border #4a4a4a → `line-control`, none x #6e6e6e → `text-2`.
- Color row in the Macros right-click menu: 24px swatches added (color stays 16, radius 4 → `radius-sm`), gap between colors 5 → 0, selected ring 1px with a 2px offset → 2px inside the swatch, order green, teal, slate, yellow, orange, rose, violet, gray → teal, green, yellow, orange, rose, violet, slate, gray, row height 32 → 28, menu width 210 → 240, gap between "색" and the first color 11 → 8.
