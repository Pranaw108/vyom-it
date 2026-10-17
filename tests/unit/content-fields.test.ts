import { describe, expect, it } from 'vitest';
import { COLLECTIONS, getCollection } from '../../src/lib/content/collections';
import { blank, normalise } from '../../src/lib/content/fields';
import { COLLECTION_SCHEMAS } from '../../src/server/content/registry';
import { settings } from '../../src/data/settings';
import { services } from '../../src/data/services';
import { caseStudies } from '../../src/data/work';

describe('editor field normalising', () => {
  it('stores empty optional fields as null and trims text', () => {
    const def = getCollection('settings')!;
    const out = normalise(def.fields, { ...settings, email: '  ', companyName: '  Vyom IT  ', address: { line: '', mapUrl: '' } });
    expect(out.email).toBeNull();
    expect(out.companyName).toBe('Vyom IT');
    expect(out.address).toBeNull();
  });

  it('turns line lists into clean arrays', () => {
    const def = getCollection('engagement')!;
    const out = normalise(def.fields, { name: 'Fixed scope', bestFor: 'x', description: 'y', points: 'One\n\n Two \n' });
    expect(out.points).toEqual(['One', 'Two']);
  });

  it('drops fields hidden for the chosen project type', () => {
    const def = getCollection('work')!;
    const out = normalise(def.fields, { ...caseStudies[0], permission: { approvedBy: 'x', date: 'y', showName: true } });
    expect('permission' in out).toBe(false);
  });

  it('round-trips every seed item through the editor without losing validity', () => {
    const cases: [string, unknown][] = [['settings', settings], ...services.map((s) => ['services', s] as [string, unknown]), ...caseStudies.map((c) => ['work', c] as [string, unknown])];
    for (const [name, data] of cases) {
      const def = getCollection(name)!;
      const result = COLLECTION_SCHEMAS[def.name].safeParse(normalise(def.fields, data));
      expect(result.success, `${name}: ${JSON.stringify(result.error?.issues?.slice(0, 2))}`).toBe(true);
    }
  });

  it('a blank new item fails validation until it is filled in', () => {
    for (const def of COLLECTIONS) {
      expect(COLLECTION_SCHEMAS[def.name].safeParse(normalise(def.fields, blank(def.fields))).success, def.name).toBe(false);
    }
  });
});
