# PreviewFrame

미리보기 패널의 몸통으로, 세 출력 화면(본 화면, 무대 화면, 방송 자막) 중 하나를 크게, 나머지 둘을 작게 줄여 보여 줍니다.

## 쓰는 곳

- 진행 화면 오른쪽 열 맨 위의 미리보기 패널(ShowH, Compact, Problems).
- 준비 화면 미리보기 패널(PrepService, Reflow)의 큰 틀(`ll-monitor__frame`)만. 준비 화면은 머리글의 세그먼트로 화면을 바꾸므로 작은 미리보기 줄을 두지 않고, 이름 줄에는 이름표 색 견본(LabelChip의 `ll-label-swatch`), 이름표 이름, 위치("5 / 9"), Look 이름을 씁니다.

## 쓰지 않는 곳

- 슬라이드 썸네일: SlideThumbnail을 씁니다.
- 화면 설정, Look 편집, 무대 배치 편집의 큰 편집 캔버스.
- 클래스 `ll-preview`는 디자인 시스템 미리보기 도구의 것이므로 쓰지 않습니다. 이 컴포넌트는 `ll-monitor`입니다.

## 구성

- 바깥 `ll-monitor`: 세로로 큰 미리보기와 작은 미리보기 줄을 쌓고 사이 `space-10`. 패널 몸통이 안쪽 `panel-inset`(14)을 줍니다.
- 화면 틀 `ll-monitor__frame`: 16:9, 모서리 `radius-md`, 바탕 `output-black`, 테두리 `0 0 0 1px line`. 방송 자막은 캡처용 창 바탕과 같은 `chroma`(`ll-monitor__frame--chroma`)입니다.
- 화면 내용 `ll-monitor__screen`: 출력 창과 같은 렌더러를 틀 너비로 줄여 넣는 자리(canvas, video 등)입니다. 안의 글자 크기와 색은 Look이 정하며 UI 토큰을 쓰지 않습니다. 틀에 `container-type: inline-size`가 있어 HTML로 그릴 때도 `cqw`로 비율을 맞출 수 있습니다.
- 큰 미리보기 이름 줄 `ll-monitor__caption`: 틀 아래 `space-10`. 화면 이름 `label-strong`(12/16/600) `text`, 대상 `label` `text-3`(앞에 14px `monitor` 아이콘, 사이 `space-4`), Look 이름은 오른쪽 끝 `label` `text-3`. 항목 사이 `space-8`. 대상이 NDI면 아이콘 없이 글자만 씁니다.
- 작은 미리보기 줄 `ll-monitor__smalls`: 두 칸 격자, 사이 `space-10`. 칸 `ll-monitor__small`은 버튼이며 틀 아래 `space-6`에 이름 줄(`caption` 11/14, 이름 `text-2`, 대상 `text-3`, 사이 `space-6`). Look 이름은 쓰지 않습니다.
- 좁은 창(`ll-monitor--compact`): 작은 미리보기가 줄로 바뀝니다. 틀 너비 64px(높이 36), 틀과 글자 사이 `space-8`, 이름과 대상을 두 줄로(사이 `space-2`).
- 높이가 모자라 진행 도구 240을 지킬 수 없으면 미리보기 패널이 줄어듭니다. 이때 큰 틀은 16:9를 지킨 채 높이에 맞춰 작아지고 가운데에 놓입니다(Layout 참고).

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
|---|---|---|---|
| 기본 | 큰 틀 = 열 안쪽 너비 × 9/16, 작은 틀 = (너비 − 10) / 2 × 9/16 | 이름 줄 `label-strong`/`label`, 작은 칸 `caption` | 보통 창, 넓은 창(오른쪽 열 480, 560) |
| 좁은 창 `--compact` | 큰 틀 같음, 작은 칸 36(틀 64×36) | 같음, 작은 칸은 두 줄 | 좁은 창(오른쪽 열 360) |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
|---|---|---|---|
| 출력 켜짐(기본) | 화면 내용 | 이름 `text`(작은 칸 `text-2`), 대상과 Look `text-3` | 틀 1px `line` |
| 작은 칸 마우스 올림 | 같음 | 같음 | 틀 1px `line-control` |
| 작은 칸 포커스 | 같음 | 같음 | 칸 둘레 `outline: 2px solid accent`, offset 3px |
| 출력 꺼짐 | 화면 내용 그대로 | 이름 `text-off` | 틀 1px `line-strong`. title "본 화면 출력이 꺼져 있습니다" |
| 모니터 빠짐 | 화면 내용 그대로 | 대상 `warning`, 앞 아이콘을 `warning` 아이콘으로 바꿈 | 틀 1px `warning`. title "모니터 3 연결 끊김, 창으로 표시 중" |

출력 꺼짐: 시안 ShowH에서 툴바의 출력 버튼을 끄면 버튼 글자색과 점만 바뀌고 미리보기는 그대로입니다. 꺼진 동안에도 다시 켤 때 나갈 내용을 봐야 하므로 그림은 흐리게 하지 않고, 이름만 `text-off`로, 틀만 한 단 밝은 `line-strong`으로 바꿉니다. 꺼짐은 툴바 출력 버튼이 주로 알리고 미리보기는 거들기만 합니다.

모니터 빠짐 테두리는 마우스를 올려도 그대로 둡니다. 출력 꺼진 칸에는 마우스 올림이 보입니다.

## 동작

- 작은 칸을 누르면 그 화면이 크게 오고, 크게 보이던 화면은 작은 줄로 내려갑니다. 작은 줄의 순서는 항상 본 화면 → 무대 화면 → 방송 자막 중 큰 것을 뺀 순서입니다.
- 큰 미리보기는 누를 수 없습니다.
- 작은 칸은 `button`, `aria-label="무대 화면 크게 보기"`. 상태가 있으면 이유를 붙입니다: "무대 화면 크게 보기, 모니터 3 연결 끊김".
- 상태는 `data-state="off"` 또는 `data-state="warning"`을 큰 미리보기(`ll-monitor__main`)나 작은 칸에 겁니다.
- 포커스 순서: 작은 칸 왼쪽 → 오른쪽.
- 출력 화면 쪽에는 움직임을 넣지 않으므로 자리를 바꿀 때도 전환 효과 없이 바로 바꿉니다.

## 글쓰기

- 이름 줄에는 화면 이름, 대상, Look 이름만 씁니다. "출력 중", "꺼짐", "창으로 표시 중" 같은 설명은 글자로 붙이지 않고 title 툴팁으로 줍니다.
- 화면 이름은 "본 화면", "무대 화면", "방송 자막". 대상은 "모니터 2", "NDI". Look 이름은 사용자가 지은 그대로("기본", "현재와 다음", "하단 자막").

## 구현 메모

- `<PreviewFrame screens={[main, stage, broadcast]} big="main" compact={sizeClass === 'narrow'} onSwap={(id) => …} />`
- 각 화면: `{ id: 'stage', name: '무대 화면', target: { kind: 'display', label: '모니터 3' }, look: '현재와 다음', state: 'on' | 'off' | 'warning', chroma: false }`
- 클래스: `ll-monitor`, `ll-monitor--compact`, `ll-monitor__main`, `ll-monitor__frame`, `ll-monitor__frame--chroma`, `ll-monitor__screen`, `ll-monitor__caption`, `ll-monitor__name`, `ll-monitor__target`, `ll-monitor__look`, `ll-monitor__smalls`, `ll-monitor__small`.
- 미리보기 고정용 `.is-hover`, `.is-focus`.

## 시안과 달라진 점

- ShowH, Compact, Problems, PrepService, Reflow: 화면 틀 모서리 3px → `radius-md` 4px(썸네일, 미디어 칸과 맞춤).
- ShowH, Problems: 작은 칸 이름 #cfcfcf → `text-2`. 작은 칸 hover는 칸 전체 고리 → 틀에만 1px `line-control`.
- Compact: 작은 미리보기 줄의 틀 80px → 64px, 패널 안쪽 12 → 14, 사이 8 → 10. 큰 이름 줄의 대상 앞에 `monitor` 아이콘을 붙입니다.
- Problems: 작은 칸 이름 줄 "⚠ 창으로 표시 중" → "⚠ 모니터 3"(대상을 `warning`으로) + title 툴팁.
