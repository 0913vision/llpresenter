# Review request: `data-73`

- Team member: data
- Branch: `docs/data/shared-media-bin`
- Base: latest local main after rebase; range in the member report.
- Related decision: "Media lives in one bottom 미디어 bin", October 26.

## What changed and why

Spec 04 and 05 now place one shared media bin below the normal 진행 and 준비
workspace columns. The media toggle controls visibility without switching away
from the editor. The bin contains its own playlist column, content and selected
item preview/properties. The same import, copy, relink and drop behavior applies
in both workspaces. The toggle must look distinct from workspace navigation; ui
owns that style.

The existing `mediaStrip` preference controls the same visibility in both
workspaces. Keep existing size/DIP defaults and explicit-choice precedence.
Ignore the old `prepMedia` mode while retaining its stored field for compatible
round trips. Workspace switches and hide/reopen keep the in-window playlist and
selection; hidden players release media. Cross-references in 01, 02, 10 and the
spec index now describe the shared bin instead of two different media surfaces.

The request preserves existing activation semantics during the layout move: 진행
single-click selects and outputs; 준비 single-click selects, double-click
outputs. This is an explicit continuation of the existing 04/05 rules, not a new
claim about ProPresenter's Edit mode. The freeze still pauses extra P6b
features; the following requests move the existing bin functionality in small
units.

## Evidence and scope

Checked Renewed Vision's
[interface documentation](https://support.renewedvision.com/hc/en-us/articles/360041345954-Understanding-The-ProPresenter-User-Interface)
on October 26. It supports the Media visibility control, bottom location and
left playlist column. It does not establish the same bin's behavior in Edit
mode. The shared 준비 bin, embedded properties and distinct toggle style come
from the user's recorded decision.

## Changes outside my paths

All six changed specification files are spec-owned. The lead directed the media
bin move after its 04/05 rows were sent as a documentation request. The matching
references keep data and shortcut descriptions consistent with those rows.

`design/system/project/components/Layout/README.md` is ui-owned. Round 2
reconciles its old center-column strip rule with the shared-bin user decision
and defines the allocation and overflow rules required by this finding.

## Checks

- Documentation only; formatting, diff and reference checks in the report.
- CI pending (API 403); the lead confirms the exact head before merging.

## Checked in the app

This request changes specification text only. It does not change the running UI.
The implementation requests will each build, exercise the changed bin offscreen
through CDP, repeat the flow, check DOM/memory and attach screenshots. The
current two-surface baseline was checked in data-72, including its
[진행 screenshot](https://github.com/0913vision/llpresenter/blob/c2bb9f8781a71e46ad12bd173187a375db5d6fb0/docs/reviews/assets/data-72/import-show.png)
and
[준비 screenshot](https://github.com/0913vision/llpresenter/blob/c2bb9f8781a71e46ad12bd173187a375db5d6fb0/docs/reviews/assets/data-72/properties.png).
Those are current-state evidence, not screenshots of the proposed shared bin.

## Team member's reply

1. R1: Replaced Layout's 170px center-column strip rule, state table and old
   default example with the shared full-width bin. Layout and spec 04/05 now
   reserve a 440px upper workspace, bound the bin to 168..300px and 40% of
   work-area height, and reduce the bin before shrinking the workspace. The
   minimum 1280x720 saved-open example is explicit: 440px workspace, 4px gap,
   178px bin. Smaller CSS viewports retain the saved choice and scroll the
   combined minimum work area; panel bodies scroll without growing the rows. The
   original implementation requests need to adopt this clarified height rule
   before integration. Rebase conflicts keep the newer group and optional
   default-off import-copy decisions intact.
