/**
 * CMS parity: everything in the JSON files the CMS edits must be editable in
 * public/admin/config.yml, and every required CMS field must exist in the data.
 *
 * Catches content added in code (e.g. a new key in faq.json) that editors
 * cannot see or change in /admin/ – and fields an editor would be forced to
 * fill because the data lacks them.
 */
import { describe, expect, test } from "bun:test";

interface Field {
  name: string;
  widget?: string;
  required?: boolean;
  fields?: Field[];
  field?: Field;
}

const config = Bun.YAML.parse(await Bun.file("public/admin/config.yml").text()) as {
  collections: { name: string; files?: { name: string; file: string; fields: Field[] }[] }[];
};

/**
 * Custom widgets own their value; list the keys each one reads and writes.
 * gallery-manager: public/admin/gallery-manager.js (+ media-upload.js).
 */
const CUSTOM_WIDGET_KEYS: Record<string, Set<string>> = {
  "gallery-manager": new Set(["media", "alt", "bonus", "panorama", "hidden", "focus", "width", "height"]),
};

/** Widgets whose value may be missing in the data without problems. */
const OPTIONAL_WIDGETS = new Set(["boolean"]);

type Issue = string;

function check(value: unknown, fields: Field[], path: string, issues: Issue[]) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${path}: expected an object`);
    return;
  }
  const data = value as Record<string, unknown>;
  const byName = new Map(fields.map((field) => [field.name, field]));

  for (const key of Object.keys(data)) {
    const field = byName.get(key);
    if (!field) {
      issues.push(`${path}.${key}: in the data but not in config.yml – editors cannot change it`);
      continue;
    }
    checkField(data[key], field, `${path}.${key}`, issues);
  }

  for (const field of fields) {
    const optional = field.required === false || OPTIONAL_WIDGETS.has(field.widget ?? "string");
    if (!optional && !(field.name in data)) {
      issues.push(`${path}.${field.name}: required in config.yml but missing in the data`);
    }
  }
}

function checkField(value: unknown, field: Field, path: string, issues: Issue[]) {
  const widget = field.widget ?? "string";
  const custom = CUSTOM_WIDGET_KEYS[widget];
  if (custom) {
    const items = Array.isArray(value) ? value : [value];
    items.forEach((item, index) => {
      for (const key of Object.keys(item ?? {})) {
        if (!custom.has(key)) issues.push(`${path}[${index}].${key}: not handled by the ${widget} widget`);
      }
    });
    return;
  }
  if (widget === "object" && field.fields) {
    if (value !== undefined) check(value, field.fields, path, issues);
    return;
  }
  if (widget === "list" && field.fields) {
    if (!Array.isArray(value)) {
      issues.push(`${path}: expected a list`);
      return;
    }
    value.forEach((item, index) => check(item, field.fields!, `${path}[${index}]`, issues));
  }
}

const entries = config.collections.flatMap((collection) =>
  (collection.files ?? []).map((file) => ({ ...file, collection: collection.name })),
);

describe("CMS parity (public/admin/config.yml ↔ src/data)", () => {
  test("config.yml has file collections to check", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const entry of entries) {
    test(`${entry.collection}: ${entry.file}`, async () => {
      const data = await Bun.file(entry.file).json();
      const issues: Issue[] = [];
      check(data, entry.fields, entry.file, issues);
      expect(issues).toEqual([]);
    });
  }
});
