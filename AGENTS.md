# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Current Design Decisions

- Source visual: `exec-48af3866-8453-4cef-a6e6-c34cb0d960c4.png`.
- Use typography, whitespace, thin colored race bars, and a warm off-white canvas; do not introduce images, avatars, mascots, or illustrations.
- Default to an IKEA-inspired freely licensed geometric sans; winning a race unlocks an alternate display font.
- Typing is error-gated: an incorrect key does not advance the cursor, and Backspace is unnecessary and does not move progress backward.
- Friend races use shareable peer-to-peer rooms with one host and up to three live guests; never show simulated racers as if they were connected players.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
