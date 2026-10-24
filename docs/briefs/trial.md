# 전달 문서: trial

- 세션 이름: trial
- 브랜치: `rewrite/trial` (자기 worktree)
- 개발 서버 포트: 5190, 앱 데이터 폴더: `D:\llp-dev\trial`(초반 틀이 `LLP_DEV_PORT`, `LLP_USER_DATA`를 받습니다)
- 단계: 1단계, 초반 틀이 rewrite에 들어간 뒤

## 목표

팀 작업 방식이 이 Windows 컴퓨터에서 실제로 도는지 확인합니다: worktree, 의존성 설치, 타입 검사와 빌드, 개발용 앱 실행, 리뷰 요청, 메시지, 리베이스, 빨리 감기 합치기.

## 할 일

1. worktree 정보를 기록합니다: `git rev-parse --show-toplevel`의 경로와 그 글자 수, `git branch --show-current`, 기준 커밋(`git merge-base HEAD rewrite`).
2. `npm ci`를 돌리고 걸린 시간과 `node_modules` 크기를 기록합니다.
3. `npm run typecheck`와 `npm run build`를 돌리고 결과를 기록합니다.
4. `LLP_DEV_PORT=5190`, `LLP_USER_DATA=D:\llp-dev\trial`로 `npm run dev`를 백그라운드로 띄워 20초 기다린 뒤, 개발 서버 주소(포트)와 Electron 프로세스가 떴는지 기록하고 모두 끕니다. 팀장의 개발용 앱(5173)이 떠 있어도 부딪치지 않는지 확인합니다. 끈 뒤 남은 Electron 프로세스가 없는지 확인합니다.
5. `docs/reviews/trial-1.md`를 `docs/reviews/_template.md` 양식으로 써서 위 결과를 담고 커밋합니다. 품질 점검 칸은 해당 없음으로 둡니다.
6. 최신 rewrite 위로 리베이스한 뒤 팀장에게 SendMessage로 "리뷰 요청: docs/reviews/trial-1.md, 브랜치 rewrite/trial, 커밋 <해시>"를 보내고 기다립니다.
7. 팀장이 rewrite에 커밋을 하나 더 넣고 다시 리베이스를 요청하면, 리베이스하고(충돌이 나면 스스로 풀고) 리뷰 문서의 "팀원의 답"에 리베이스 결과를 적어 커밋한 뒤 다시 알립니다.
8. 팀장이 합쳤다고 알리면 끝입니다.

## 하지 않을 일

- 코드, 설정, 의존성을 바꾸지 않습니다.
- 이 전달 문서와 리뷰 문서 말고는 파일을 만들거나 고치지 않습니다.

## 소유 파일

- `docs/reviews/trial-1.md`

## 읽을 것

- `CLAUDE.md`, `docs/WORKFLOW.md`

## 완료 기준

- 위 1부터 8까지의 결과가 리뷰 문서에 남고, 브랜치가 rewrite에 빨리 감기로 합쳐집니다.
- 문제가 있으면(경로가 너무 김, 설치 실패, 프로세스가 안 꺼짐, 메시지가 안 감) 그대로 적습니다. 고치려 하지 않습니다.
