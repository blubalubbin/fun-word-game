# Design QA

## Evidence

- Source visual truth: `reference/selected-design.png`
- Implementation screenshot: `implementation-active.png`
- Same-input comparison: `design-comparison.png`
- Source pixels: 1487 x 1058. Implementation pixels / CSS viewport: 1280 x 930 at 1x. The comparison uses contain-fit normalization in adjacent 744 x 529 panels.
- Compared state: a live two-player race with both players overlapping on the same expected character.
- Focused interaction evidence: the transparent typing input measured 350 x 499 CSS px in a 390 px mobile-width browser pass, accepted focus from a typing-panel click, exposed `inputMode=text` at 16 px, rejected an incorrect key without advancing, and synchronized progress between host and guest.
- Console errors checked after the final multiplayer and input passes: none.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- [P3] The implementation uses a slightly heavier geometric sans and game-specific sentence. This remains an intentional product adaptation of the reference hierarchy.
- [P3] Live room status, waiting lanes, and the invite action add functional information not present in the static concept while preserving its type-led density.

## Required Fidelity Surfaces

- Fonts and typography: passed. Oversized active copy, compact monospaced labels, tight tracking, and the unlocked display face preserve the reference hierarchy.
- Spacing and layout rhythm: passed. The warm full-canvas layout retains the header, four thin race lanes, central typing field, and four-part metric rail.
- Colors and visual tokens: passed. The off-white, black, cobalt, tomato, and yellow palette remains intact; self green and HSV overlap cyan extend it coherently for live presence.
- Image quality and asset fidelity: passed. The design contains no required imagery or icons, and none were introduced.
- Copy and content: passed. Game-specific status and instruction copy remain short and visually subordinate.

## Comparison History

1. Earlier implementation used a 1 px input with `pointer-events: none`, placed the caret after the expected letter, and did not expose overlapping player positions.
2. The input became a full-panel direct tap target, the caret moved to the previous character edge, the expected character gained a tinted underline, and shared positions gained HSV color mixing.
3. Post-fix browser evidence confirmed focusable mobile geometry, error-gated typing, bidirectional multiplayer updates, cyan `#03add3` for green/blue overlap, and no console errors.

## Implementation Checklist

1. Preserve the full-panel mobile input target.
2. Keep the expected-character highlight and preceding caret paired.
3. Keep player colors attached to room identities and blend only when positions coincide.

## Follow-up Polish

- Test the deployed build on physical iOS Safari and Pixel Chrome because desktop browser emulation cannot prove virtual-keyboard behavior on those devices.

final result: passed
