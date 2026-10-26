# Typography

The October 27 user decision sizes the operator UI for a 1920x1080 full-screen
window. No UI text is smaller than 14px, including tooltips and LIVE badges.
This replaces the earlier one-step proposal and its micro exception. The
project README is the current size reference for every component; examples use
the named `type-*` tokens.

| Role | Before this revision | Current size/line height |
| --- | --- | --- |
| Heading | 20/28 | 22/30 |
| Titles, panel tabs, service-order name | 16/22 | 18/26 |
| Body, strong body, bands, strong captions | 16/22 | 16/22 |
| Labels, captions, toolbar names and tooltips | 14/20 | 14/20 |
| LIVE micro badge | 12/16 | 14/20 |
| Output and thumbnail lyrics | Output-relative | Unchanged |

Weights and Pretendard remain unchanged. Single-line rows stay 30px, menu rows
28px, small controls 26px and medium controls 30px. A two-line row grows to
52px to hold 22px + 2px + 20px with breathing room. LIVE and count badges and
keycaps are 22px high. Check 1920x1080 and the minimum 1280x720 without clipped
labels or horizontal page scrolling. Do not reduce fonts to fit. Ellipsize long
names with their existing tooltip, and scroll lists vertically.

The gallery shows the token scale, badges, tooltips and representative controls. Existing
component cards retain their hover, selected, disabled and focus specimens
using this scale. The app check covers real 진행, 준비 and 화면 설정 at both
window sizes, including live marks, service rows, labels and properties.
