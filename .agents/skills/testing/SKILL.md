---
name: testing
description: Write and run tests for anewstyle.cz with bun test – CMS parity (every field in the CMS-edited JSON is editable in config.yml), data loaders (gallery, prices, patterns, FAQ), i18n key parity, the image pipeline rules, and regression checks for bugs. Use for every change (a change without a test is not done), when adding a CMS field or content, or when a test fails.
---

# Testing

Runner: **`bun test`** (built into Bun, no extra dependency). Tests live in `tests/**/*.test.ts` and import project code directly. They are not type-checked by `bun run typecheck` (`tests/` is excluded from `tsconfig.json`); keep them simple TypeScript.

```bash
bun test                     # all
bun test tests/cms-parity    # one file
```

## When tests run automatically

- After an agent edits content or content code – Claude Code hook `.claude/hooks/test-on-content-change.sh` (registered in `.claude/settings.json`); a failure comes back as feedback to fix.
- On every push and pull request on GitHub – `.github/workflows/test.yml` (client commits, CMS drafts).

## What exists

| File | Guards |
| --- | --- |
| `tests/cms-parity.test.ts` | Every key in `products.json`, `prices.json`, `faq.json`, `gallery-cms.json` is declared in `public/admin/config.yml` (so editors can change it), and every non-optional CMS field exists in the data. |
| `tests/content.test.ts` | Data the site depends on: gallery entries resolve to image sets or Cloudinary videos, mineral surcharges parse, mineral patterns have images, FAQ mineral fallback, i18n key parity cs ↔ en. |
| `tests/image-pipeline.test.ts` | Width rules (never upscale, 18 % rule, caps) and watermark placement. |

## Rules for new work

- **Every change ships with a test** that fails without the change: a new CMS field → parity covers it automatically, plus a test of how the site reads it; a bug fix → a regression test for the exact case; new content logic → a unit test of the function.
- Put logic you want to test in a plain `.ts` module (`src/lib/…`) instead of inside an `.astro` frontmatter – components are hard to test, functions are easy.
- Test data rules, not current values (e.g. "every surcharge is a positive number", not "L is 3 350").
- When a test catches a real gap (e.g. a field customers added in code but not in the CMS), fix the gap – do not loosen the test. Intentional exceptions go into the explicit allow-list in the test with a comment why.

## When the build output must not change

For refactors that move content from code to data, build before and after and diff the relevant HTML (`dist/index.html`, `dist/en/index.html`) – the rendered output must be identical.
