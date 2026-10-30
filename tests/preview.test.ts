import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("local preview reliability", () => {
  test("dev and production preview use stable ports and fail instead of silently switching", () => {
    const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));

    expect(scripts.dev).toContain("--host 0.0.0.0 --port 4321 --strictPort");
    expect(scripts.preview).toContain("--host 0.0.0.0 --port 4322 --strictPort");
  });

  test("development clears a stale service worker and its caches once", () => {
    const layout = readFileSync("src/layouts/Layout.astro", "utf8");

    expect(layout).toContain("anewstyle-dev-preview-cleaned-v1");
    expect(layout).toContain("navigator.serviceWorker.getRegistrations()");
    expect(layout).toContain("caches.keys()");
    expect(layout).toContain("registration.unregister()");
    expect(layout).toContain("location.reload()");
    expect(layout).toContain("import.meta.env.DEV && (");
  });
});
