# LabelChip

곡의 장 묶음(1절, 프리코러스, 후렴)을 이름표 색으로 칠해 보이는 칩이며, 준비 화면의 구성 줄과 가사 블록, 목록 안의 작은 이름표에 씁니다.

## 쓰는 곳

- 구성 줄 칩 30px: 준비 화면 예배 순서 항목의 "구성"(PrepService). 칩 순서가 아래 썸네일 순서와 같고, 끌어서 순서를 바꿉니다.
- 작은 이름표 22px: 라이브러리 곡 편집(Reflow), 가져온 곡 편집(ImportEdit, ImportSave)의 가사 블록 왼쪽, 텍스트 가져오기(ImportText) 미리보기, 목록 줄 안.
- 색 견본 10px: 준비 화면 미리보기 아래 이름 줄("■ 프리코러스 5 / 9").
- 이름표 색 연결(`data-color`)은 SlideThumbnail 띠, MacroTile도 함께 씁니다.

## 쓰지 않는 곳

- 썸네일 아래 띠: SlideThumbnail의 `ll-thumb__band`.
- 이름표 색을 고르는 견본 줄: LabelColorPicker(`ll-swatch`).
- 상태를 알리는 칩(출력 중, 경고): 상태는 고리와 아이콘으로 보입니다(규칙 18).

## 구성

- 이름표 색: `data-color="teal|green|yellow|orange|rose|violet|slate|gray"`. 칠하는 색은 `label-*`, 글자는 `text-on-label`. 속성이 없으면 이름표 없음이며 `label-none` + 글자 `label-gray`.
- 구성 줄 `ll-chip-strip`: 줄바꿈되는 가로 줄, 칩 사이와 줄 사이 `space-8`.
- 칩 `ll-chip`: 높이 `size-control-md`(30), 모서리 `radius-sm`, 왼쪽 `space-6` 오른쪽 `space-10`, 글자 `band`(12/16/700). 앞에 14px `grip` 아이콘(불투명도 0.55), 아이콘과 글자 사이 `space-6`. 이름표가 없는 묶음은 그 묶음의 번호("4")를 씁니다.
- 넣기 자리 `ll-chip-add`: 30×30, `radius-sm`, 1px 점선 `line-control`, 14px `plus` 아이콘 `text-2`. 줄 맨 끝에 둡니다.
- 놓을 자리 `ll-chip-drop`: 끄는 동안 칩 사이 틈 가운데에 2px × 30 `accent` 막대(`radius-full`). 틈을 넓히지 않도록 좌우 여백을 −5px로 당깁니다.
- 작은 이름표 `ll-tag`: 높이 `size-control-xs`(22), `radius-sm`, 좌우 `space-8`, 글자 `band`. 이름표를 고르는 버튼이면 뒤에 12px `down` 아이콘(사이 `space-6`, 오른쪽 `space-6`)을 붙이고, 이름표가 없을 때 글자는 "이름표"입니다.
- 색 견본 `ll-label-swatch`: 10×10, `radius-xs`. 이름표가 없으면 속을 비우고 1px `line-control` 테두리.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
|---|---|---|---|
| 칩 `ll-chip` | 30 `size-control-md` | `band` | 구성 줄 |
| 넣기 `ll-chip-add` | 30 | 아이콘 14 | 구성 줄 끝 |
| 작은 이름표 `ll-tag` | 22 `size-control-xs` | `band` | 가사 블록, 목록 줄 |
| 고르기 이름표 `button.ll-tag` | 22 | `band` + 12px 화살표 | 가사 블록(이름표 메뉴를 엶) |
| 색 견본 `ll-label-swatch` | 10 | 없음 | 미리보기 이름 줄 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
|---|---|---|---|
| 기본 | `label-*` / `label-none` | `text-on-label` / `label-gray`, 손잡이 0.55 | |
| 마우스 올림(색 칩) | 그대로 | 손잡이 불투명도 1 | 커서 grab |
| 마우스 올림(이름표 없음) | `bg-control-hover` | 손잡이 불투명도 1 | |
| 고름 | 그대로 | 그대로 | 2px 틈(`bg-panel`) + 2px `accent` |
| 출력 중 | 그대로 | 그대로 | 2px 틈 + 2px `live` |
| 포커스 | 그대로 | 그대로 | `outline: 2px solid accent`, offset 5px(고리 바깥) |
| 끄는 중 | 그대로 | 손잡이 1 | `shadow-popover`, 커서 grabbing. 놓을 자리에 `ll-chip-drop` |
| 넣기 마우스 올림 / 누름 | `bg-raised` / `bg-control-hover` | `text-2` / `text` | |
| 작은 이름표 메뉴 열림 | 그대로 | 그대로 | 2px 틈 + 1px `text`(`aria-expanded="true"`) |

고리 앞의 2px 틈은 색 칩 위에서 고리가 칩 색과 섞이지 않게 하려는 것입니다(남색 칩과 `accent`는 밝기 차이가 1.1:1). 칩이 30px라 출력 중 고리도 3px가 아닌 2px로 씁니다. 틈 색은 `--ll-chip-gap`(기본 `bg-panel`)으로 바꿀 수 있습니다.

색 칩의 hover는 바탕색을 바꾸지 않습니다. 이름표 색이 곧 정보라 hover 회색(#333333)으로 덮으면 안 되기 때문입니다.

## 동작

- 구성 줄은 `role="listbox"`, `aria-orientation="horizontal"`, 칩은 `role="option"` + `aria-selected`. 화살표 키로 고르고, 고른 칩은 아래 썸네일도 함께 고릅니다.
- 칩을 끌어 순서를 바꿉니다. 키보드로는 Alt + ←/→로 고른 칩을 한 칸 옮깁니다. Delete로 그 자리의 장을 구성에서 뺍니다(곡에서 지우지 않습니다).
- 넣기(+)는 이름표 메뉴를 열어 넣을 묶음을 고르게 합니다. `aria-label="장 넣기"`.
- 고르기 이름표는 `aria-haspopup="menu"`, 열리면 `aria-expanded="true"`. 메뉴는 Menu 규칙(규칙 11)을 따릅니다.
- 출력 중인 묶음의 칩은 `data-state="live"`.

## 글쓰기

- 칩 글자는 이름표 이름 하나입니다. 개수나 "(2)" 같은 반복 표시를 붙이지 않습니다. 같은 묶음이 두 번 나오면 칩이 두 개입니다.
- 이름표가 없으면 묶음 번호만 씁니다("4"). 고르기 이름표에서는 "이름표"라고 씁니다.
- 이름표 이름 예: "1절", "2절", "프리코러스", "후렴", "브리지", "간주", "엔딩".

## 구현 메모

- `<ArrangementStrip items={[{ id, name: '1절', color: 'teal', n: 1 }, …]} selected={4} live={2} onReorder onInsert />`
- `<LabelChip name="후렴" color="yellow" selected live dragging />`, `<LabelTag name="후렴" color="yellow" picker onOpen />`, `<LabelSwatch color="green" />`
- 클래스: `ll-chip-strip`, `ll-chip`, `ll-chip__grip`, `ll-chip-add`, `ll-chip-drop`, `ll-tag`, `ll-label-swatch`. 끄는 중은 `.is-dragging`.
- 이름표 색 연결 규칙(`--ll-label`, `--ll-label-fg`)이 이 파일에 있습니다. 썸네일과 매크로 타일도 같은 `data-color`를 씁니다.

## 시안과 달라진 점

- PrepService 구성 줄: 칩 모서리 4px → `radius-sm` 3px, 칩 사이 6 → 8, 고른 칩 고리 "2px 틈 + 1px #ececec" → "2px 틈 + 2px `accent`"(썸네일의 고름과 같은 색), 칩 hover #333333 → 손잡이 불투명도만, 이름표 없는 칩 글자 #b4b4b4 → `label-gray`, 넣기 점선 #4a4a4a → `line-control`.
- Reflow, ImportEdit, ImportSave 가사 블록: 이름표 24px → 22px, 이름표 없음 글자 #8c8c8c(`bg-control` 위 `text-3`) → `label-gray`, 화살표 불투명도 0.7 → 1, 활성 블록 이름표의 흰 고리 → 메뉴가 열렸을 때만.
- ImportText: 이름표 24px → 22px.
