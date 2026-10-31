import { describe, expect, it } from 'vitest';
import type { FieldSpec } from '../../src/lib/content/fields';
import { changedFields, isLiveVersion } from '../../src/lib/content/history';

const fields: FieldSpec[] = [
  { type: 'text', name: 'title', label: 'Title' },
  { type: 'textarea', name: 'summary', label: 'Summary' },
  { type: 'list', name: 'faqs', label: 'Questions', itemLabel: 'Question', fields: [{ type: 'text', name: 'q', label: 'Q' }] },
];

describe('changedFields', () => {
  it('names only the fields that differ', () => {
    expect(changedFields(fields, { title: 'A', summary: 'S', faqs: [] }, { title: 'B', summary: 'S', faqs: [] })).toEqual(['Title']);
  });

  it('sees changes inside lists', () => {
    expect(changedFields(fields, { faqs: [{ q: 'one' }] }, { faqs: [{ q: 'two' }] })).toEqual(['Questions']);
  });

  it('treats missing and null as the same', () => {
    expect(changedFields(fields, { title: 'A' }, { title: 'A', summary: null })).toEqual([]);
  });

  it('reports nothing for the oldest kept version', () => {
    expect(changedFields(fields, null, { title: 'A' })).toEqual([]);
  });
});

describe('isLiveVersion', () => {
  it('matches only identical published data', () => {
    expect(isLiveVersion({ title: 'A' }, { title: 'A' })).toBe(true);
    expect(isLiveVersion({ title: 'A' }, { title: 'B' })).toBe(false);
    expect(isLiveVersion({ title: 'A' }, null)).toBe(false);
  });
});
