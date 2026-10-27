# Workflow

We work as a team. The lead session is the team lead, and the work sessions are
team members. Each team member works in their own git worktree and branch, and
when the work is done, sends the lead a review request (PR). Both the lead and
the reviewer must approve, and only rebased branches are merged into the
integration branch, by fast-forward only.

The integration branch is `main`. The lead manages it. Team members work on
their own branches and send review requests, and the lead merges them into
`main`. The 2024 code is kept as the tag `legacy-2024`. The old integration
branch `rewrite` is retired; it stays on GitHub only as history.

## Roles

| Who                        | Responsibilities                                                                                                                                                                                                                                  | Doesn't                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| User                       | Starting and ending phases, decisions that aren't in the plan, ruling on what the lead and the reviewer can't agree on                                                                                                                            |                                                                                    |
| Lead                       | Maintaining `docs/PLAN.md` and `docs/STATUS.md`, changing the shared contracts and shared files, starting team member sessions, writing briefs, reviewing, calling the reviewer, merging after approval, integration tests, reporting to the user | Change a team member's owned files, or resolve conflicts on a team member's behalf |
| Team member (work session) | Implementing the scope of the brief, rebasing their branch onto the latest `main` and resolving conflicts themselves, writing review requests, addressing review comments, asking questions                                                       | Change shared files, touch other branches, or commit directly to `main`            |
| Reviewer                   | Only reads review requests, reviews them independently, and gives an approval or a change request                                                                                                                                                 | Change code                                                                        |

The reviewer is Codex (joined on 2026-10-24). It runs in its own tmux window,
which the user started, in the lead's checkout. It has full access by the user's
setting, so every review prompt tells it to stay read-only: read branches with
`git diff` and `git show`, and never edit files, commit, switch branches, or
install anything. Codex can't use SendMessage, so the lead sends it the review
request with `tmux send-keys` and reads the verdict from its window. If Codex
isn't available, the lead starts a read-only Claude Code session in a tmux
window instead, in a detached worktree at the reviewed commit (never a
subagent).

## Starting sessions

- The session that handled phase 0 ("프로프리젠터 프로젝트 찾기", Find the
  ProPresenter project) continues as the lead. If that session ends or its
  context grows too long, a new session takes over as the lead with
  `docs/briefs/lead.md`.
- The lead runs in `<main checkout>` (`main`) with permission prompts turned
  off. Team members start in the same mode. If the modes differ, messages
  between sessions stall while they wait for the user's approval.
- The lead runs inside tmux and starts each team member as an independent
  interactive Claude Code session in a new tmux window (user rule). Never use
  agent team teammates or background subagents for member work.
  1. `git worktree add .claude/worktrees/<name> -b <tag>/<name>/<feature> main`
  2. Write `.llp/start.md` in the worktree: role, brief, branch, and the lead's
     session name for SendMessage.
  3. `tmux new-window -d -n <name> -c '<worktree path>'` (single quotes keep the
     Windows path intact).
  4. `tmux send-keys -t 0:<name> "claude --dangerously-skip-permissions --remote-control <name>" Enter`,
     then send the prompt "Read .llp/start.md in this folder and follow it." and
     a separate Enter.
  5. Read a member's screen with `tmux capture-pane -p -t 0:<name>`. The user
     can open each session from the phone through Remote Control.
- Before you start a session, commit its brief to `main`. The worktree starts
  from the last commit on `main`.
- At most three team members run at the same time.

## Pull request flow

The flow follows an ordinary GitHub pull request flow, kept on this computer
because it has no GitHub CLI. `docs/MEMBER.md` has the steps for team members
and `docs/REVIEW.md` the steps for reviewers.

1. One ticket is one branch, one pull request, and one squashed commit on
   `main`.
2. The pull request is a short file in the author's worktree,
   `.llp/pr/<name>.md`, outside git. Its title is the commit message `main`
   gets.
3. Before pushing, the author runs the typecheck, the format check, ESLint on
   the changed files, and the tests related to them. The dispatcher sends the
   pull request to a reviewer only after the branch's exact-head CI run passes.
4. One reviewer reviews the range. Approve when only nits remain; the author
   puts nits in the next branch. The lead reads the diff in the sensitive paths
   (`src/main/outputs`, `live`, `store`, `windows`, `media`, and `src/preload`)
   or has a second reviewer read it.
5. The dispatcher, or the lead for sensitive paths, squash-merges the branch
   onto local `main` after a passing typecheck. Merge conflicts go back to the
   author. Nobody rebases or rewrites `main` itself.
6. Review conversation, screenshots, measurements, and local details never go
   into the repository. Committed files hold the product: code, tests, specs,
   plans, and decisions.

## Questions

- Team members can ask the lead with SendMessage at any time. Don't guess about
  shared contracts (shared types, commands, schemas, tokens), scope, or gaps in
  the spec. Ask.
- What the lead can't answer (product decisions) goes to the user. The lead
  records the answer in `docs/decisions.md` and then passes it on to the team
  member.
- When a team member finishes a turn, the app notifies the lead automatically.
  The lead then checks the message and the pull request. The lead doesn't rely
  on the report alone, and looks at the actual changes and test results.
- The lead's instructions and answers also go by SendMessage (to that session's
  `local_...` ID).

## Documents

Write every document in English, following the style guides in `CLAUDE.md`.

| File                    | Who  | Contents                                                                |
| ----------------------- | ---- | ----------------------------------------------------------------------- |
| `docs/briefs/<name>.md` | Lead | Brief. Template: `docs/briefs/_template.md`                             |
| `docs/STATUS.md`        | Lead | State of the phases, bundles, and review requests                       |
| `docs/decisions.md`     | Lead | New decisions made during implementation, one entry each, with the date |

## When to clear

Principle: clear a session only when everything the next person needs to know is
in files. The commits are done, the documents are updated, and no messages are
waiting and no reviews are open.

| Who         | When to clear                                                                                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead        | When a phase ends and there are no active team members and no open review requests. After updating and committing `docs/STATUS.md` and `docs/HANDOFF.md`. Before the conversation grows long enough to trigger automatic summarization |
| Team member | Never. Each bundle gets one session. After the merge, the session is archived, and the next bundle starts in a new session                                                                                                             |
| Reviewer    | It's started fresh for each review request, so there's nothing to clear                                                                                                                                                                |

Every session, the lead included, can be compacted (summarized automatically) at
any time. `CLAUDE.md` under "Context and compaction" says how to survive it:
keep `.llp/notes.md` current, and the SessionStart hook prints the notes, the
git state, and `docs/STATUS.md` back after every compaction.

The current lead session is under Remote Control, so the app's rules don't let
it be cleared. When its context grows long, rely on compaction, but always keep
`.llp/notes.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` up to date. When the
lead moves to a new session, the new session takes over with those two documents
and `docs/briefs/lead.md`.

The first message after a clear is always "Read CLAUDE.md, docs/HANDOFF.md, and
docs/STATUS.md, then continue."

## Port and app data folder assignments

The app reads the dev server port (`LLP_DEV_PORT`) and the app data folder
(`LLP_USER_DATA`) from environment variables, so several copies can run without
colliding. Each session's port and folder are machine-specific, so the lead
keeps the table outside the repository and gives each session its own.

## Milestones and QA

The team works in milestones (`docs/MILESTONES.md`). Each milestone is split
into tasks with one owner each, built in parallel, then frozen with a tag
`m<number>`. The qa member tests the tag while everyone else starts the next
milestone. Bugs come back as `fix/<name>/<bug>` branches and go before new work
when they are blockers. A milestone closes when QA signs off and the user has
seen it run.

## Branch names

Branches follow `<tag>/<name>/<feature>` (user rule):

- `<tag>` is the commit tag that describes the branch's main change: `break`,
  `feat`, `fix`, `refactor`, `style`, `docs`, or `chore`.
- `<name>` is the member's session name, for example `ui`.
- `<feature>` is a short kebab-case name for the change, for example
  `form-controls`.
- Examples: `feat/ui/form-controls`, `chore/devops/verify`,
  `docs/trial/workflow-check`.

Rules:

- Always exactly three parts. Git stores a branch as a file, so `feat/ui` and
  `feat/ui/button` can't both exist, and nothing can live under `main/`.
- One branch per review request. You create your next branch yourself, without
  waiting for the lead.

## Stacked branches

Don't wait for a merge to keep working. Stack the next branch on the one under
review:

1. **Start:** if your previous branch is merged, branch from `main`. If it is
   still in review, branch from it:
   `git switch -c <tag>/<name>/<next> <previous>`.
2. **Keep the stack fresh:** when you change a lower branch after review
   comments, rebase the branches above it onto it
   (`git rebase --onto <lower> <lower-before-the-change> <upper>`, or
   `git rebase --update-refs` from the top branch).
3. **After the lower branch merges:** it lands as one squashed commit, so move
   the next branch onto `main` with
   `git rebase --onto main <old head of the lower branch> <next>`, so only its
   own commits remain.
4. **Review requests go out in stack order.** Send the next request only after
   the one below it is merged and the next branch is rebased onto `main`.
   Mention the stack in the pull request ("stacked on ui-1").
5. Keep stacks shallow, two or three branches. If a lower branch needs a large
   rework, pause the upper ones instead of rebasing them again and again.

- If a tool names a new worktree's branch itself, rename it first
  (`git branch -m <tag>/<name>/<feature>`). The SessionStart hook tells sessions
  apart by the `<name>` part.

## Windows pitfalls

- Keep the working folder path short. If the path is too long, node fails to
  start.
- `.gitattributes` fixes line endings to LF.
- Before a rebase or a merge, stop the dev app and the dev server in that
  folder. Windows locks files that are in use, and git fails.
- When you leave work running for a long time, keep the computer plugged in (on
  battery, it sleeps after 15 minutes).
- Don't use tmux. The Claude app starts and manages the sessions.

## GitHub

- Repository: https://github.com/0913vision/llpresenter (public). Only the lead
  pushes `main`. Before the first push, confirm with the user that the
  repository is public.
- CI: GitHub Actions runs `npm ci` and `npm run verify` on a Windows runner when
  `main` is pushed (set up by devops). The local `npm run verify` comes first.
  CI on GitHub checks once more in a clean environment.
- Reviews use local pull request files (see "Pull request flow") because this
  computer has no GitHub CLI.
- On 2026-10-24, `main` was fast-forwarded to the rewrite (3c3efb7). It started
  from the last commit of the 2024 code (9b23462), so no force push was needed.

## Codex

- The lead decides with the user when to add Codex (around phase 3). The user
  installs it and signs in.
- Reviewer sessions run read-only and follow `docs/REVIEW.md`.
