# AlertDialog

질문 하나에 답해야 넘어가는 확인 창입니다. 왼쪽 40px 아이콘 칸, 제목, 부가 정보, 버튼 줄로 되어 있고, 고를 상태가 몇 개 붙는 창(출력 상태 복구)은 같은 머리 묶음 아래에 목록 구획을 둡니다.

## 쓰는 곳

- 같은 제목의 곡이 있을 때 저장하기(ImportSave): "‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?"
- 비정상 종료 뒤 다시 켤 때(Recovery): "출력 상태 복구"와 복구할 상태 고르기
- 되돌릴 수 없는 삭제 앞

## 쓰지 않는 곳

- 입력이 여러 개이거나 긴 목록에서 고르는 일: `Dialog`를 씁니다.
- 답이 필요 없는 알림: `Notification`을 씁니다.
- 일이 끝났다는 확인("저장했습니다", "지웠습니다"): 띄우지 않습니다.

## 구성

- 막과 자리: `Dialog`와 같습니다(`ll-scrim`, 메뉴줄 아래부터 덮고 가운데).
- 면 `ll-alert`: 너비 `dialog-s`(460px), 바탕 `bg-dialog`, 모서리 `radius-2xl`, 그림자 `shadow-dialog`, 안쪽 위 `space-20` 좌우 `space-20` 아래 `space-16`. 머리글과 바닥글 선은 없습니다.
- 머리 묶음 `ll-alert__head`: 아이콘 칸 + `space-14` + 글 묶음, 위쪽 정렬.
  - 아이콘 칸 `ll-alert__icon`: 40×40, 바탕 `bg-panel`, 모서리 `radius-lg`, 아이콘 24px `text-2`. 무엇에 관한 질문인지를 보입니다(곡 `song`, 복구 `history`).
  - 제목 `ll-alert__title`: `heading`(16/22/600), 낱말 단위 줄바꿈.
  - 부가 정보 `ll-alert__meta`: 제목 아래 `space-2`, `label`(12/16) `text-3`, 숫자 고정폭. 값이 둘 이상이면 사이 `space-10`("비정상 종료  10월 25일 오전 11:26").
  - 제목이 한 줄이면 글 묶음 높이(22 + 2 + 16)가 아이콘 칸 40px과 같습니다.
- 목록 구획 `ll-alert__list`(목록형, `ll-alert--list`): 너비 `dialog-m`(600px). 머리 묶음 아래 `space-16`, 위 1px `line`. 묶음 이름은 `ListRow`의 `ll-row-group`(좌우 0, 위 10 아래 5), 줄은 `Checkbox`의 `ll-check-row`(30px, 좌우 여백과 hover 없음, 이름 칸 168px `--fixed`, 값 `__value` `label` `text-3`). 줄이 많아 창을 넘으면 이 구획만 스크롤합니다.
- 버튼 줄 `ll-alert__actions`: 위 `space-20`, md 버튼(30px), 사이 `space-8`. [취소] `ll-alert__cancel`은 왼쪽 끝, 나머지는 오른쪽, 주 버튼은 맨 오른쪽. [취소]가 없는 창은 모두 오른쪽에 둡니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 질문 하나 (dialog-s) | 126 (20 + 40 + 20 + 30 + 16, 제목 한 줄) | heading 16/22/600, label 12/16 text-3 | 같은 곡 덮어쓰기, 삭제 확인 |
| 목록형 (dialog-m) | 내용 (줄마다 30) | 위와 같음 + 체크 줄 body 13/18 | 출력 상태 복구 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 열림 | 막 `scrim` + 면 `bg-dialog` | | 160ms 페이드, 주 버튼에 포커스 |
| 보조 버튼 | `bg-control` | `text` | hover와 누름 `bg-control-hover`(`Button`) |
| 주 버튼 | `accent-fill` | `text-on-fill` 600 | hover와 누름 `accent-fill-hover` |
| 체크 줄 꺼짐 | `bg-well` 상자 | `text` | 그 상태는 복구하지 않음 |
| 모든 체크 꺼짐 | 주 버튼 `bg-control` | 주 버튼 `text-off` | [복구]는 쓸 수 없음(`aria-disabled`) |

## 동작

- 열면 주 버튼에 포커스를 둡니다. Enter는 주 버튼, Esc는 [취소]입니다. [취소]가 없는 출력 상태 복구는 Esc가 [새로 시작]입니다.
- Tab 순서: 체크 줄(있으면) → 왼쪽부터 버튼.
- 확인 창에는 닫기(×) 버튼이 없습니다. 막을 눌러도 닫지 않습니다.
- 확인 창 위에 다른 확인 창을 겹쳐 열지 않습니다.
- 출력 상태 복구는 앱이 뜨자마자 열리고, 답하기 전까지 세 화면은 대기 상태입니다(상태 표시줄 "대기").
- 출력 지우기 단축키(F1~F7)는 확인 창이 열려 있어도 동작합니다(`Dialog`와 같음).
- aria: `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`에 제목, `aria-describedby`에 부가 정보. 목록 구획은 `role="group"` + 묶음 이름.

## 글쓰기

- 제목은 물음 하나로 끝냅니다: "‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?" 대상 이름은 ‘ ’로 감쌉니다.
- 무엇을 묻는지 분명한 창은 제목을 명사로 씁니다: "출력 상태 복구".
- 부가 정보는 판단에 필요한 사실만: "라이브러리 곡 4장, 10월 20일 수정", "비정상 종료  10월 25일 오전 11:26". 설명 문단을 쓰지 않습니다.
- 버튼은 일어날 일을 동사로: "덮어쓰기", "새 곡으로 저장", "복구", "새로 시작". "예", "아니요", "확인"을 쓰지 않습니다.

## 구현 메모

- `<AlertDialog icon="song" title="‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?" meta={['라이브러리 곡 4장, 10월 20일 수정']} cancel="취소" actions={[{ label: '새 곡으로 저장' }, { label: '덮어쓰기', primary: true }]} />`
- `<AlertDialog icon="history" title="출력 상태 복구" meta={['비정상 종료', '10월 25일 오전 11:26']} list={{ label: '복구할 상태', items: [{ icon: 'mplay', label: '화면 출력', value: '본 화면, 무대 화면, 방송 자막', checked: true }, …] }} actions={[{ label: '새로 시작', escape: true }, { label: '복구', primary: true }]} />`
- 클래스: `ll-alert`, `ll-alert--list`, `ll-alert__head`, `ll-alert__icon`, `ll-alert__text`, `ll-alert__title`, `ll-alert__meta`, `ll-alert__list`, `ll-alert__actions`, `ll-alert__cancel`.

## 시안과 달라진 점

- ImportSave: 바탕 #262626 → `bg-dialog`. 막 rgba(0, 0, 0, 0.45) 창 전체 → `scrim` 메뉴줄 아래부터. 아이콘 칸 36×36, 모서리 8, `bg-panel` + 1px #3a3a3a, 아이콘 18 → 40×40 `radius-lg` 테두리 없음, 아이콘 24. 아이콘과 글자 사이 14 그대로. 제목 14/20 → `heading` 16/22, 제목과 부가 정보 사이 6 → 2. 보조 버튼 #333333 → `bg-control`. 주 버튼 #3d8bf0 → `accent-fill`, 좌우 16 → 14. 그림자 0 20px 48px → `shadow-dialog`.
- Recovery: 아이콘 칸 #262626, 모서리 8 → `bg-panel`, `radius-lg`, 아이콘 `text` → `text-2`. 머리 묶음 가운데 정렬 → 위 정렬, 제목과 부가 정보 사이 3 → 2. 묶음 이름 위 12 아래 6 → 10, 5. 줄 높이와 간격은 `Checkbox` 문서에 적었습니다. 바닥글(위 1px 선, 높이 60, 좌우 20) → 선 없는 버튼 줄(위 20, 아래 16). 버튼 32 → 30. 그림자 0 20px 48px → `shadow-dialog`.
