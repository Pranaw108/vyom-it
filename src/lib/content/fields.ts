// Field descriptions for the admin editor. Shared by the server (normalising input) and the
// browser editor (rendering forms). Validation itself always uses the Zod schemas.

export interface Option {
  value: string;
  label: string;
}

interface Base {
  name: string;
  label: string;
  hint?: string;
  /** Empty input is stored as null (schema field is nullable). */
  nullable?: boolean;
  showIf?: { field: string; equals: string };
}

export type FieldSpec =
  | (Base & { type: 'text' | 'url' | 'email' })
  | (Base & { type: 'textarea'; rows?: number })
  | (Base & { type: 'select'; options: Option[] })
  | (Base & { type: 'boolean' })
  | (Base & { type: 'number' })
  | (Base & { type: 'lines' })
  | (Base & { type: 'image' })
  | (Base & { type: 'group'; fields: FieldSpec[] })
  | (Base & { type: 'list'; itemLabel: string; fields: FieldSpec[] });

type Data = Record<string, unknown>;

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Turns raw editor input into the shape the schemas expect (trimmed strings, nulls, numbers, arrays). */
export function normalise(fields: FieldSpec[], input: unknown): Data {
  const source = (input && typeof input === 'object' ? input : {}) as Data;
  const out: Data = {};
  for (const field of fields) {
    if (field.showIf && source[field.showIf.field] !== field.showIf.equals) continue;
    const raw = source[field.name];
    switch (field.type) {
      case 'text':
      case 'url':
      case 'email':
      case 'textarea':
      case 'select':
      case 'image': {
        const value = typeof raw === 'string' ? raw.trim() : '';
        out[field.name] = value === '' && (field.nullable || field.type === 'image') ? null : value;
        break;
      }
      case 'boolean':
        out[field.name] = raw === true || raw === 'true' || raw === 'on';
        break;
      case 'number':
        out[field.name] = isEmpty(raw) ? 0 : Number(raw);
        break;
      case 'lines': {
        const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('\n') : [];
        out[field.name] = list.map((s) => String(s).trim()).filter(Boolean);
        break;
      }
      case 'group': {
        const group = normalise(field.fields, raw);
        const allEmpty = Object.values(group).every((v) => isEmpty(v) || (Array.isArray(v) && v.length === 0));
        out[field.name] = field.nullable && allEmpty ? null : group;
        break;
      }
      case 'list':
        out[field.name] = (Array.isArray(raw) ? raw : []).map((item) => normalise(field.fields, item));
        break;
    }
  }
  return out;
}

/** A blank item for a list or a new entry. */
export function blank(fields: FieldSpec[]): Data {
  const out: Data = {};
  for (const f of fields) {
    if (f.type === 'boolean') out[f.name] = false;
    else if (f.type === 'number') out[f.name] = 0;
    else if (f.type === 'lines' || f.type === 'list') out[f.name] = [];
    else if (f.type === 'group') out[f.name] = blank(f.fields);
    else if (f.type === 'select') out[f.name] = f.options[0]?.value ?? '';
    else out[f.name] = '';
  }
  return out;
}

/** Adapts stored data for the editor (null becomes empty input). */
export function forEditor(fields: FieldSpec[], data: unknown): Data {
  const source = (data && typeof data === 'object' ? data : {}) as Data;
  const out: Data = { ...source };
  for (const f of fields) {
    const v = source[f.name];
    if (f.type === 'group') out[f.name] = forEditor(f.fields, v ?? blank(f.fields));
    else if (f.type === 'list') out[f.name] = (Array.isArray(v) ? v : []).map((item) => forEditor(f.fields, item));
    else if (f.type === 'lines') out[f.name] = Array.isArray(v) ? v : [];
    else if (v === null || v === undefined) out[f.name] = f.type === 'boolean' ? false : f.type === 'number' ? 0 : '';
  }
  return out;
}
