# LabelColorPicker

이름표와 매크로의 색을 고르는 색 칸 한 줄입니다. 라이브러리 곡 편집의 이름표 메뉴와 매크로 우클릭 메뉴 안에 들어갑니다.

## 쓰는 곳

- 라이브러리 곡 편집(Reflow), 가져온 곡 편집(ImportEdit): 블록의 이름표 칩을 눌러 연 이름표 메뉴의 색 줄(없음 + 8색)
- 매크로: 타일 우클릭 메뉴의 "색" 줄(8색, 없음은 없음)

## 쓰지 않는 곳

- 출력 화면 안의 글자색이나 바탕색: Look 편집의 색 칸(16px 견본 + 값)을 씁니다. 그 색은 이름표 색이 아닙니다.
- 메뉴 항목 앞의 작은 이름표 견본(18×12): `Menu`의 `ll-menu__swatch`입니다. 고르는 칸이 아닙니다.

## 구성

- 줄 `ll-swatches`: 색 칸을 틈 없이 붙여 늘어놓습니다. 칸 안 여백이 그대로 색 사이 틈(8px)이 됩니다.
- 메뉴 안 줄 `ll-swatches--menu`: 높이 `size-row-menu`(28), 안쪽 `space-2` `space-4`. 첫 색의 왼쪽 끝이 메뉴 항목의 앞 칸(왼쪽 14px)에 맞습니다.
- 줄 앞 이름 `ll-swatches__label`: 매크로 메뉴의 "색". `body`(13/18) `text`, 메뉴 항목 글자와 같은 선에서 시작.
- 색 칸 `ll-swatch`: 누르는 곳 24×24, 모서리 `radius-md`. 가운데 색 `ll-swatch__chip` 16×16, 모서리 `radius-sm`.
- 색: `label-teal`(청록), `label-green`(초록), `label-yellow`(노랑), `label-orange`(주황), `label-rose`(분홍), `label-violet`(보라), `label-slate`(남색), `label-gray`(회색). 이 순서로 놓습니다.
- 없음 `ll-swatch--none`: 바탕 `label-none`, 테두리 `inset 0 0 0 1px` `line-control`, 가운데 `x` 12px `text-2`. 줄 맨 앞에 둡니다.
- 고름: 칸 안쪽 2px `text` 고리(`inset 0 0 0 2px`). 색과 고리 사이 2px가 비어 어느 색 위에서도 고리가 보입니다. `ring-selected`(파랑)는 남색, 보라와 구별이 어려워 쓰지 않습니다. 시안(Reflow, Macros) 둘 다 흰 고리입니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 이름표 색 줄 | 28 | - | 이름표 메뉴: 없음 + 8색, 9칸 216px |
| 매크로 색 줄 | 28 | 앞 이름 body 13/18 | 매크로 우클릭 메뉴: "색" + 8색 |

## 상태

| 상태 | 바탕(칸) | 색 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | 투명 | 이름표 색 | |
| 마우스 올림 | bg-control-hover | 같음 | 메뉴 항목 hover와 같은 바탕 |
| 고름 | 투명 | 같음 | 안쪽 2px text 고리, `aria-checked="true"` |
| 포커스 | 같음 | 같음 | outline 2px accent, offset 1px |
| 쓸 수 없음 | 두지 않음 | | 색을 바꿀 수 없을 때는 메뉴를 여는 칩이나 메뉴 항목을 쓸 수 없게 합니다 |

## 동작

- 누르면 바로 그 색이 적용되고 메뉴는 열린 채로 둡니다. 이름표 색을 바꾸면 그 이름표를 쓰는 모든 장의 띠 색이 함께 바뀝니다.
- 키보드: 줄에 탭이 한 번 들어가고(고른 색에 포커스), 좌우 화살표로 옮기며 바로 고릅니다. 메뉴 안에서는 위아래 화살표가 메뉴 항목 사이를 옮기다가 색 줄에 들어오면 좌우 화살표로 색을 옮깁니다.
- aria: 줄 `role="radiogroup"`과 `aria-label`(예: "후렴 색", "색"), 칸 `role="radio"` `aria-checked` `aria-label`(색 이름: 청록, 초록, 노랑, 주황, 분홍, 보라, 남색, 회색, 없음).

## 글쓰기

- 색 이름은 툴팁과 `aria-label`로만 보입니다. 줄 옆에 색 이름을 글로 쓰지 않습니다.
- 색 이름은 위의 아홉 개만 씁니다. "파랑"이나 "하늘색" 같은 다른 이름을 섞지 않습니다.

## 구현 메모

- `<LabelColorPicker value="yellow" allowNone onChange aria-label="후렴 색" />`
- `<LabelColorPicker value="green" label="색" />`(매크로: `allowNone` 없이)
- 마크업: `div.ll-swatches[.ll-swatches--menu][role=radiogroup] > [span.ll-swatches__label] + button.ll-swatch.ll-swatch--<색>[role=radio][aria-checked] > span.ll-swatch__chip`. 없음은 칩 안에 `span.ll-i.ll-i-x`.
- 메뉴 안에 넣을 때는 `Menu`의 항목과 구분선(`ll-menu__sep`) 사이에 줄을 그대로 넣습니다.
- 클래스: `ll-swatches`, `ll-swatches--menu`, `ll-swatches__label`, `ll-swatch`, `ll-swatch__chip`, `ll-swatch--none`, `ll-swatch--teal|green|yellow|orange|rose|violet|slate|gray`.

## 시안과 달라진 점

- Reflow 이름표 메뉴의 색 줄: 색 18 → 16, 칸 사이 4 → 0(24px 칸이 맞닿음), 고른 고리 칸 바깥 2px → 칸 안쪽 2px, 줄 여백 4 8 6 → 2 4, 없음 테두리 #4a4a4a → `line-control`, 없음 x #6e6e6e → `text-2`.
- Macros 우클릭 메뉴의 색 줄: 24px 칸 추가(색 16 그대로, 모서리 4 → `radius-sm`), 색 사이 5 → 0, 고른 고리 2px 띄운 1px → 칸 안쪽 2px, 순서 초록, 청록, 남색, 노랑, 주황, 분홍, 보라, 회색 → 청록, 초록, 노랑, 주황, 분홍, 보라, 남색, 회색, 줄 높이 32 → 28, 메뉴 너비 210 → 240, "색"과 첫 색 사이 11 → 8.
