# Review request: `data-77`

- Team member: data
- Branch: `break/data/media-copy-option-spec`
- Exact base/range: member report.
- User decision: October 27, media copy on import is optional and off by
  default.

## What changed and why

Spec 02 defines `media.copyOnImport`, default false, and snapshots the setting
per admitted request. Spec 05 applies it to both chooser and Explorer imports,
with one reachable checked option beside 가져오기 while the full Preferences
window is absent. Spec 10 replaces the former default-on override with the
user's default-off decision. Existing media and already queued requests keep
their paths and policy. Original source files survive failure/cancellation.

Renewed Vision's
[Media Management article](https://support.renewedvision.com/hc/en-us/articles/360041815133-ProPresenter-Media-Management)
was checked October 27: disabled references the existing file; enabled copies
into managed storage. Default off is the user's explicit decision, also
documented by the PP7 Preferences guide and qa-12's guide citation. The bin's
local option placement and request snapshot timing are our implementation
choices, not claims about ProPresenter's UI or job internals.

## Changes outside my paths

Spec 02/05/10 define the assigned data and import behavior. The following
implementation requests must use existing UI menu primitives and settings IPC;
this request changes no runtime or common component.

## Checks

- Formatting and diff checks: final results in member report.
- Full verify: CI pending (API 403); lead confirms the exact head.

## Checked in the app

Prose only, with no changed screen. Implementation requests must demonstrate
both policies through real-app imports, repeated menu open/close, saved setting
reload and current-selection stability, with screenshots. This request does not
claim the existing app already exposes or consumes the setting.

## Team member's reply

1. R1 P2: Removed the remaining mandatory-copy rule from spec 02's Media list,
   updated README open question 12 to the October 27 default-off decision, and
   replaced spec 10's default-on proposal in row 15. All now specify optional
   copying, default off, using the same `media.copyOnImport` setting. Searched
   the specifications for other mandatory-copy/default-on media-import rules.
