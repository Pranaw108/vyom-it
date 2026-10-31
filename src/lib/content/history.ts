import type { FieldSpec } from './fields';

type Data = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Labels of the top-level fields that differ between two versions, e.g. ["Title", "Summary"]. */
export function changedFields(fields: FieldSpec[], before: Data | null, after: Data): string[] {
  if (!before) return [];
  return fields.filter((f) => !same(before[f.name], after[f.name])).map((f) => f.label);
}

/** True when a version holds exactly what is live now. */
export function isLiveVersion(data: Data, published: Data | null): boolean {
  return published !== null && same(data, published);
}

export const EVENT_LABELS = {
  save: 'Saved',
  publish: 'Published',
  restore: 'Restored',
  baseline: 'Starting point',
} as const;
