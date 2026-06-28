# Architecture

A high-level map of the codebase for developers. For what the plugin does and how to use it, see [README.md](README.md).

## Build

`main.ts` is the esbuild entry point (see `esbuild.config.mjs`); it pulls in everything under `src/`. The bundle is emitted to `main.js`, which is the file Obsidian actually loads (per `manifest.json`). `manifest.json` and the build config reference `main.ts`/`main.js` only, so the `src/` layout is free to change.

- `npm run dev` — watch-mode build with inline sourcemaps.
- `npm run build` — type-check (`tsc -noEmit`) then a minified production bundle.

## Source layout

| File | Contents |
|------|----------|
| `src/types.ts` | `Contact`, `Discord`, settings interfaces + `DEFAULT_SETTINGS` |
| `src/parse.ts` | Code-block parsing + phone/email/birthday/age formatting |
| `src/frontmatter.ts` | Frontmatter → `Contact` conversion (field aliases, normalization) |
| `src/card.ts` | `buildContactCardEl` — the shared DOM builder for all three render paths |
| `src/livePreview.ts` | CM6 block widget + StateField extension + refresh effect (the Live Preview path) |
| `src/settings.ts` | `ContactCardSettingTab` |
| `main.ts` | Plugin class wiring the three render paths together |

## Render paths

A contact card can be produced three ways, all funnelling through `buildContactCardEl` in `src/card.ts`:

1. **Code block** — a `contact` code block, parsed by `parseStringsToMap` → `parseMapToContact` (`src/parse.ts`).
2. **Reading view** — built from a note's frontmatter and prepended to the preview (`upsertReadingCard` in `main.ts`).
3. **Live Preview** — a CodeMirror block widget rendered at the top of the note (`src/livePreview.ts`).

`src/settings.ts` and `src/livePreview.ts` import the plugin class as `import type` only, so there is no runtime circular dependency even though `main.ts` imports values back from them.
