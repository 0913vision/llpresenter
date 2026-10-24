# ClearButton

진행 화면 오른쪽 열의 지우기 줄입니다. 출력 화면에서 층 하나(가사, 미디어, 소품, 오디오, 메시지, 공지) 또는 모두를 한 번에 내리고, 마지막 지우기를 되돌립니다.

## 쓰는 곳

- 진행 화면 오른쪽 열, 출력 미리보기 아래의 지우기 줄(보통 창과 좁은 창).
- 성경 화면처럼 진행 화면과 같은 오른쪽 열을 쓰는 곳.

## 쓰지 않는 곳

- 목록이나 칸의 내용을 지우는 일(입력 칸 비우기, 항목 삭제): Button, IconButton.
- 진행 도구의 표시 중 목록에서 하나씩 내리기: IconButton(내리기).
- 지우기 줄에 다른 명령을 섞지 않습니다. 되돌림 하나만 구분선 뒤에 둡니다.
- 여러 층을 골라 한 번에 지우는 버튼(프로프리젠터의 Clear Groups에 해당)은 v1에 두지 않습니다. 그런 조합은 매크로의 지우기 동작으로 만들고, 필요하면 예배 순서 항목의 시작할 때 매크로에 겁니다.

## 구성

- 줄: 바탕 `bg-panel`, 모서리 `radius-lg`, 안쪽 `space-8`, 버튼 사이 `space-4`. 줄 자체가 패널 하나이며 머리글이 없습니다.
- 순서: 모두, 가사, 미디어, 소품, 오디오, 메시지, 공지, 구분선, 되돌림.
- 버튼: 높이 `size-clear-button`(52px), 모서리 `radius-md`, 아이콘 `size-icon-18` 위에 이름 `caption-strong`(11/14/600), 사이 `space-4`. 너비는 줄을 나눠 가집니다(flex 1). 모두는 1.4배.
- 아이콘: 모두 `layers`, 가사 `text`, 미디어 `image`, 소품 `prop`, 오디오 `audio`, 메시지 `msg`, 공지 `notice`, 되돌림 `undo`.
- 구분선: 1×32, `line`, 좌우 `space-4`(버튼 사이 틈과 합쳐 8).
- 되돌림: 바탕 `bg-toolbar-hover`. 지우기 버튼보다 한 단 낮게 두어 다른 일임을 보입니다.
- 좁은 창: 줄 안쪽 `space-6`, 버튼 높이 40, 아이콘 `size-icon-16`만, 이름 없음. 구분선 1×24, 좌우 `space-2`. 모두는 그대로 1.4배라서 넓이로 구별됩니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 지우기 | `size-clear-button` 52 | `caption-strong` | 보통 창(열 `col-right` 480) |
| 모두 | 52, 너비 1.4배 | `caption-strong` | 줄의 첫 자리 |
| 되돌림 | 52 | `caption-strong` | 구분선 뒤 마지막 자리 |
| 좁은 형태 | 40 | 이름 없음(아이콘 16) | 좁은 창(열 `col-right-compact` 360) |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 지울 것 있음 | `bg-control` | `text` | 그 층이 지금 화면에 나가고 있음 |
| 마우스 올림, 누름 | `bg-control-hover` | `text` | 100ms ease-out |
| 지울 것 없음 | `bg-control-off` | `text-off` | hover 없음, 눌러도 아무 일 없음 |
| 되돌림 쓸 수 있음 | `bg-toolbar-hover` | `text` | hover는 `bg-control-hover` |
| 되돌릴 것 없음 | `bg-toolbar-hover` | `text-off` | hover 없음 |
| 포커스 | 그대로 | 그대로 | 키보드 포커스에만 `outline: 2px solid accent`, offset 1px |

출력 중이라고 빨강을 쓰지 않습니다. 지울 것이 있는지만 밝기로 보입니다.

## 동작

- 누르면 그 층을 바로 지웁니다. 확인 창을 띄우지 않습니다. 잘못 눌렀으면 되돌림으로 돌립니다.
- 모두는 지울 것이 있는 층을 한 번에 지웁니다. 층이 하나라도 남아 있으면 모두는 지울 것 있음 상태입니다.
- 되돌림은 마지막 지우기(모두 포함) 하나를 되돌립니다. 되돌린 뒤에는 되돌릴 것 없음이 됩니다.
- 단축키: 모두 F1, 가사 F2, 미디어 F3, 소품 F4, 오디오 F5, 메시지 F6, 공지 F7, 되돌리기 Ctrl Z. 단축키는 포커스가 어디 있든 진행 화면에서 동작합니다.
- 지울 것 없는 버튼은 `disabled` 대신 `aria-disabled="true"`와 `data-state="off"`를 줍니다. 포커스와 툴팁이 남고 단축키를 눌러도 아무 일이 없습니다.
- 각 버튼은 `aria-label="가사 지우기"`와 `aria-keyshortcuts="F2"`를 줍니다. 줄은 `role="group"`(이름 "지우기").
- 툴팁: 이름 뒤 `space-8`에 단축키를 `text-3`으로 붙입니다. "가사 지우기 F2", "모두 지우기 F1", "되돌리기 Ctrl Z".

## 글쓰기

- 버튼 이름은 층의 이름 한 낱말입니다: 모두, 가사, 미디어, 소품, 오디오, 메시지, 공지. 되돌리는 버튼은 "되돌림".
- 툴팁과 `aria-label`은 "층 이름 + 지우기"로 씁니다: "가사 지우기". 되돌림은 "되돌리기".
- 지운 뒤 알림 문구를 띄우지 않습니다. 버튼이 지울 것 없음으로 바뀌는 것으로 충분합니다.

## 구현 메모

```jsx
<ClearRow compact={narrow}>
  <ClearButton layer="all" active={anyOn} onClear={clearAll} />
  <ClearButton layer="slide" active={on.slide} onClear={() => clear('slide')} />
  …
  <ClearUndo available={!!last} onUndo={undo} />
</ClearRow>
```

- `layer`가 아이콘, 이름, 단축키를 정합니다(위 목록). `active={false}`이면 `data-state="off"`와 `aria-disabled`를 그립니다.
- 클래스: 줄 `ll-clear-row`, 좁은 형태 `ll-clear-row--compact`, 구분선 `ll-clear-row__divider`, 버튼 `ll-clear`, 모두 `ll-clear--all`, 되돌림 `ll-clear--undo`, 이름 `ll-clear__label`(좁은 형태에서 숨김).

```html
<button class="ll-clear" aria-label="가사 지우기" aria-keyshortcuts="F2">
  <span class="ll-i ll-i-text" aria-hidden="true"></span><span class="ll-clear__label">가사</span>
</button>
```

## 시안과 달라진 점

- ShowH, Problems, Bible: 지울 것 없는 버튼 글자 #5c5c5c → `text-off`. 되돌릴 것 없는 되돌림 글자 #5c5c5c → `text-off`.
- ShowH: 툴팁 "가사 지우기 F2"를 한 덩어리 글자로 쓰던 것 → 단축키를 `space-8` 띄우고 `text-3`.
- Compact: 모두 너비 1.6배 → 1.4배. 모두 아래 10px 이름 → 없앰(아이콘만). 구분선 높이 26 → 24. 툴팁 "가사 지우기" → "가사 지우기 F2", "되돌리기" → "되돌리기 Ctrl Z".
