# SlideThumbnail

슬라이드 한 장을 16:9 출력 캔버스와 24px 이름표 띠로 보여 주는 썸네일이며, 진행 화면의 슬라이드 격자와 준비 화면의 장 목록에 씁니다.

## 쓰는 곳

- 진행 화면 슬라이드 패널(ShowH, Compact, Problems). 누르면 그 장이 출력됩니다.
- 준비 화면 예배 순서 항목(PrepService). 구성 순서대로 늘어놓습니다.
- 준비 화면 라이브러리 곡의 장 패널(Reflow), 가져온 곡 편집(ImportEdit), 성경 구절(Bible).

## 쓰지 않는 곳

- 미디어 칸: MediaTile을 씁니다(이름이 그림 아래에 따로 있고 길이 칩이 붙습니다).
- 미리보기 패널의 화면: PreviewFrame을 씁니다(Look이 그린 실제 출력을 줄여 보입니다).
- 진행 도구의 공지, 소품 칸: 그 탭의 컴포넌트를 씁니다.

## 구성

- 바깥: `button`. 모서리 `radius-md`(4px)로 캔버스와 띠를 함께 잘라 냅니다(`overflow: hidden`). 고리는 바깥 그림자라 잘리지 않습니다.
- 캔버스: 16:9, 바탕 `output-black`. 곡의 기본 배경(따뜻한 빛 같은 배경 미디어)은 그리지 않습니다. 장 자체에 넣은 그림이나 영상만 `object-fit: cover`로 채웁니다(주일 광고 장).
- 가사: 글자 `text-on-fill`, 굵기 700, 줄 높이 1.45, 가운데 정렬, 좌우 안쪽 10%. 줄바꿈은 장에 적힌 그대로 둡니다(`white-space: pre-line`, `word-break: keep-all`).
- 가사 글자 크기 = 캔버스 너비 × 0.044. CSS는 캔버스에 `container-type: inline-size`를 두고 글자에 `font-size: 4.4cqw`를 줍니다. 최솟값은 두지 않습니다. 썸네일이 출력과 같은 자리에서 줄을 바꿔야 하기 때문입니다.
  - 시안 ShowH의 `thumbFont = 48 / 열 수`(px)는 가운데 열 1144(몸통 안쪽 1116)에서만 맞는 식입니다. 너비 비율로 바꾸면 2열 552px→24px(0.0435), 4열 270px→12px(0.0444), 6열 176px→8px(0.0455)이라 0.044 하나로 정합니다.
- 이름표 띠: 높이 `size-thumb-band`(24px), 글자 `band`(12/16/700), 왼쪽 `space-8`, 번호와 이름 사이 `space-8`, 번호는 `tabular-nums`. 이름표 색이 있으면 띠 전체를 그 색(`label-teal` 등) + 글자 `text-on-label`, 없으면 `label-none` + 글자 `label-gray`이고 번호만 씁니다. 긴 이름은 말줄임합니다.
- 격자(`ll-thumb-grid`): 열 수는 패널 바닥 줄의 크기 슬라이더가 2–8열로 정합니다. 틈 세로 `space-16`, 가로 `space-12`. 바깥 여백은 패널 몸통의 `panel-inset`(14)입니다. 기본 열 수는 창 크기 구분이 정합니다(좁은 창 3, 보통 4, 넓은 6. Layout 참고).
  - 슬라이더는 "썸네일 크기"이므로 오른쪽으로 갈수록 크게, 열은 적게 됩니다. 오른쪽 끝 2열, 왼쪽 끝 8열입니다(열 수 = 10 − 슬라이더 값, 값 2–8).

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
|---|---|---|---|
| 가사 장 | 너비 × 9/16 + 24 | 가사 너비 × 0.044 / 띠 `band` | 슬라이드 패널, 예배 순서 항목, 장 패널 |
| 미디어 장 | 너비 × 9/16 + 24 | 띠 `band` | 그림, 영상을 넣은 장(주일 광고) |

썸네일 자체에는 크기 변형이 없습니다. 크기는 격자의 열 수가 정합니다.

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
|---|---|---|---|
| 기본 | `output-black`, 띠 `label-*` 또는 `label-none` | `text-on-fill`, 띠 `text-on-label` 또는 `label-gray` | |
| 마우스 올림 | 같음 | 같음 | 바깥 1px `line-control` |
| 고름(출력 중 아님) | 같음 | 같음 | `ring-selected`(2px `accent`) |
| 출력 중 | 같음 | 같음 | `ring-live`(3px `live`). 고름보다 우선합니다 |
| 포커스 | 같음 | 같음 | `outline: 2px solid accent`, `outline-offset: 4px`(출력 중 고리 바깥) |
| 장의 미디어 파일 없음 | 빗금(`bg-inset`/`bg-well`, 135°, 6px) | 가운데 `filex` 24px `warning` | 출력 중이면 `ring-live`도 함께. 경로는 title 툴팁 |

마우스 올림은 작은 미리보기의 hover(ShowH `.pv:hover`, 1px #6e6e6e)와 같은 1px `line-control`로 정했습니다. 회색 1px이라 파란 2px(고름), 빨간 3px(출력 중)과 헷갈리지 않고, 누를 자리만 알려 줍니다. 고름이나 출력 중인 썸네일에 올리면 그 고리를 그대로 둡니다.

## 동작

- 진행 화면에서 누르면 그 장을 출력하고, 준비 화면에서 누르면 고르기만 합니다.
- 격자는 `role="listbox"`, 썸네일은 `role="option"` + `aria-selected`. Tab으로는 격자에 한 번만 들어오고(roving tabindex) 화살표 키로 옮깁니다. Enter와 Space는 누름과 같습니다.
- 출력 중인 장은 `data-state="live"`, 장의 미디어 파일이 없으면 `data-state="warning"`, 둘 다면 `data-state="live warning"`.
- `aria-label`은 번호, 이름표, 첫 줄 순서로 씁니다: "2 프리코러스, 저 천사여 찬송하세".
- 크기 슬라이더를 움직이면 열 수만 바뀌고 가사 글자는 너비를 따라갑니다.

## 글쓰기

- 띠에는 번호와 이름표 이름만 씁니다. "출력 중", "선택됨" 같은 글자를 붙이지 않습니다. 상태는 고리로 보입니다.
- 이름표 이름은 짧은 명사입니다: "1절", "프리코러스", "후렴", "브리지".
- 파일 없음 툴팁: "파일을 찾을 수 없습니다: D:\예배 미디어\광고\11월 1일 광고.png"

## 구현 메모

- `<SlideThumbnail n={2} label={{ name: '프리코러스', color: 'green' }} text={'저 천사여 찬송하세\n찬송 성부 성자 성령'} media={src} live selected missing onActivate={…} />`
- `<ThumbnailGrid columns={4}>…</ThumbnailGrid>` → `<div class="ll-thumb-grid" style="--ll-cols: 4">`
- 클래스: `ll-thumb`, `ll-thumb__canvas`, `ll-thumb__text`, `ll-thumb__media`, `ll-thumb__missing`, `ll-thumb__band`, `ll-thumb__num`, `ll-thumb__label`, `ll-thumb-grid`.
- 속성: `data-color="teal|green|yellow|orange|rose|violet|slate|gray"`(없으면 이름표 없음. 색 연결은 `42-labelchip.css`), `aria-selected`, `data-state`.
- 미리보기 고정용 `.is-hover`, `.is-focus`.

## 시안과 달라진 점

- ShowH, PrepService, Problems: 크기 슬라이더 1–5(6–2열) → 2–8열. 가사 `48 / 열 수`px → 캔버스 너비 × 0.044. 썸네일 hover 없음 → 1px `line-control`.
- Compact: 띠 22px, 11px → 24px, 12px(`band`), 격자 틈 12/10 → 16/12, 패널 안쪽 12 → 14, 가사 11px 고정 → 너비 × 0.044.
- Reflow 장 패널: 격자 틈 14/12 → 16/12, 가사 11px 고정 → 너비 × 0.044.
