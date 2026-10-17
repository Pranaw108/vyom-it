import { useEffect, useRef, useState } from 'preact/hooks';
import { getCollection } from '../../lib/content/collections';
import type { FieldSpec } from '../../lib/content/fields';
import { blank, forEditor } from '../../lib/content/fields';
import { describeState } from '../../lib/content/status';

type Data = Record<string, unknown>;
type Tone = 'good' | 'warn' | 'info' | 'muted';

interface Props {
  collection: string;
  entryKey: string | null;
  initialData: Data;
  rowVersion: number;
  initialState: { label: string; tone: Tone };
  initialIssues: string[];
  canEdit: boolean;
  canSubmit: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  isLive: boolean;
  csrf: string;
}

type Notice = { tone: 'ok' | 'error'; text: string; issues?: string[] } | null;

/** One editor for every content type, driven by the field definitions in collections.ts. */
export default function ContentEditor(props: Props) {
  const def = getCollection(props.collection)!;
  const [data, setData] = useState<Data>(props.initialData);
  // Refs, not state: a save followed by a publish in one click must use the new values immediately.
  const keyRef = useRef(props.entryKey);
  const versionRef = useRef(props.rowVersion);
  const [state, setState] = useState(props.initialState);
  const [live, setLive] = useState(props.isLive);
  const [issues, setIssues] = useState<string[]>(props.initialIssues);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // Warn before leaving with unsaved changes (FR-153).
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(next: Data) {
    setData(next);
    setDirty(true);
  }

  async function call(action: string, extra: Data = {}) {
    const response = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': props.csrf },
      body: JSON.stringify({ action, collection: def.name, key: keyRef.current ?? 'new', rowVersion: versionRef.current, ...extra }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      entry?: { key: string; rowVersion: number; reviewStatus: 'draft' | 'in_review' | 'clean'; published: unknown; draft: Data };
      issues?: string[];
      error?: string;
      rebuild?: string | null;
    };
    if (!response.ok || !body.entry) throw Object.assign(new Error(body.error ?? 'Something went wrong. Please try again.'), { issues: body.issues ?? [] });
    const entry = body.entry;
    versionRef.current = entry.rowVersion;
    setState(describeState(entry));
    setLive(Boolean(entry.published));
    setIssues(body.issues ?? []);
    if (entry.key !== keyRef.current) {
      keyRef.current = entry.key;
      history.replaceState(null, '', `/admin/content/${def.name}/${entry.key}`);
    }
    return body;
  }

  async function run(label: string, steps: () => Promise<string>) {
    setBusy(label);
    setNotice(null);
    try {
      setNotice({ tone: 'ok', text: await steps() });
    } catch (error) {
      const e = error as Error & { issues?: string[] };
      setNotice({ tone: 'error', text: e.message, ...(e.issues?.length ? { issues: e.issues } : {}) });
    } finally {
      setBusy(null);
    }
  }

  const save = async () => {
    const result = await call('save', { data });
    setDirty(false);
    return result;
  };

  const onSave = () =>
    run('save', async () => {
      const result = await save();
      return result.issues?.length ? 'Draft saved. It needs a few fixes before it can be published (see below).' : 'Draft saved.';
    });
  const onSubmit = () =>
    run('submit', async () => {
      if (dirty || !keyRef.current) await save();
      await call('submit');
      return 'Submitted for review. A content manager or owner can now publish it.';
    });
  const onPublish = () =>
    run('publish', async () => {
      if (dirty || !keyRef.current) await save();
      const result = await call('publish');
      return result.rebuild ?? 'Published.';
    });
  const onUnpublish = () =>
    run('unpublish', async () => {
      const result = await call('unpublish');
      return result.rebuild ?? 'Taken offline.';
    });

  const disabled = !props.canEdit || busy !== null;

  return (
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <form
        class="flex min-w-0 flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        {!props.canEdit && <p class="admin-flash admin-flash--error">Your role can view this content but not change it.</p>}
        <FieldList fields={def.fields} value={data} onChange={change} disabled={!props.canEdit} path={def.name} csrf={props.csrf} />
      </form>

      <aside class="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <div class="admin-card flex flex-col gap-3">
          <p class="flex items-center justify-between gap-2">
            <span class="text-sm text-muted">Status</span>
            <span class={`pill pill--${state.tone}`}>{state.label}</span>
          </p>
          {dirty && <p class="text-sm font-medium text-warning">You have unsaved changes.</p>}
          {props.canEdit && (
            <button type="button" class="admin-btn" disabled={disabled} onClick={onSave} aria-busy={busy === 'save'}>
              {busy === 'save' ? 'Saving…' : 'Save draft'}
            </button>
          )}
          {props.canEdit && props.canSubmit && !props.canPublish && (
            <button type="button" class="admin-btn admin-btn--primary" disabled={disabled} onClick={onSubmit} aria-busy={busy === 'submit'}>
              {busy === 'submit' ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
          {props.canPublish && (
            <button type="button" class="admin-btn admin-btn--primary" disabled={busy !== null} onClick={onPublish} aria-busy={busy === 'publish'}>
              {busy === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          )}
          {props.canPublish && props.canUnpublish && live && (
            <button type="button" class="admin-btn admin-btn--danger" disabled={busy !== null} onClick={onUnpublish}>
              Take offline
            </button>
          )}
          <p class="text-xs text-muted">Visitors only see published content. Publishing updates the live site within a few minutes.</p>
        </div>

        {notice && (
          <div class={`admin-flash ${notice.tone === 'ok' ? 'admin-flash--ok' : 'admin-flash--error'}`} role={notice.tone === 'ok' ? 'status' : 'alert'}>
            <p>{notice.text}</p>
            {notice.issues && <ul class="mt-2 list-disc pl-5 text-sm font-normal">{notice.issues.map((i) => <li>{i}</li>)}</ul>}
          </div>
        )}
        {!notice && issues.length > 0 && (
          <div class="admin-card text-sm" role="status">
            <p class="font-semibold text-warning">Needs fixing before publishing</p>
            <ul class="mt-2 list-disc pl-5 text-muted">{issues.map((i) => <li>{i}</li>)}</ul>
          </div>
        )}
      </aside>
    </div>
  );
}

interface FieldListProps {
  fields: FieldSpec[];
  value: Data;
  onChange: (next: Data) => void;
  disabled: boolean;
  path: string;
  csrf: string;
}

function FieldList({ fields, value, onChange, disabled, path, csrf }: FieldListProps) {
  return (
    <>
      {fields
        .filter((f) => !f.showIf || value[f.showIf.field] === f.showIf.equals)
        .map((f) => (
          <Field
            key={f.name}
            field={f}
            value={value[f.name]}
            siblings={value}
            onChange={(v, extra) => onChange({ ...value, [f.name]: v, ...extra })}
            disabled={disabled}
            id={`${path}-${f.name}`}
            csrf={csrf}
          />
        ))}
    </>
  );
}

interface FieldProps {
  field: FieldSpec;
  value: unknown;
  siblings: Data;
  onChange: (value: unknown, extra?: Data) => void;
  disabled: boolean;
  id: string;
  csrf: string;
}

function Hint({ field, id }: { field: FieldSpec; id: string }) {
  return field.hint ? <p id={`${id}-hint`} class="field-hint">{field.hint}</p> : null;
}

function Field({ field, value, siblings, onChange, disabled, id, csrf }: FieldProps) {
  const described = field.hint ? `${id}-hint` : undefined;
  const text = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);

  switch (field.type) {
    case 'text':
    case 'url':
    case 'email':
      return (
        <div class="field">
          <label for={id} class="admin-label">{field.label}</label>
          <Hint field={field} id={id} />
          <input id={id} type="text" inputMode={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'} class="admin-input" value={text} disabled={disabled} aria-describedby={described} onInput={(e) => onChange(e.currentTarget.value)} />
        </div>
      );
    case 'textarea':
      return (
        <div class="field">
          <label for={id} class="admin-label">{field.label}</label>
          <Hint field={field} id={id} />
          <textarea id={id} rows={field.rows ?? 4} class="admin-input" value={text} disabled={disabled} aria-describedby={described} onInput={(e) => onChange(e.currentTarget.value)} />
        </div>
      );
    case 'number':
      return (
        <div class="field max-w-40">
          <label for={id} class="admin-label">{field.label}</label>
          <input id={id} type="number" class="admin-input" value={text} disabled={disabled} onInput={(e) => onChange(e.currentTarget.value === '' ? 0 : Number(e.currentTarget.value))} />
        </div>
      );
    case 'select':
      return (
        <div class="field">
          <label for={id} class="admin-label">{field.label}</label>
          <Hint field={field} id={id} />
          <select id={id} class="admin-input" value={text} disabled={disabled} aria-describedby={described} onChange={(e) => onChange(e.currentTarget.value)}>
            {field.options.map((o) => <option value={o.value}>{o.label}</option>)}
          </select>
        </div>
      );
    case 'boolean':
      return (
        <label class="check">
          <input id={id} type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
          <span class="font-medium">{field.label}</span>
        </label>
      );
    case 'lines':
      return (
        <div class="field">
          <label for={id} class="admin-label">{field.label}</label>
          <Hint field={field} id={id} />
          <textarea
            id={id}
            rows={Math.max(3, (Array.isArray(value) ? value.length : 0) + 1)}
            class="admin-input"
            value={Array.isArray(value) ? value.join('\n') : ''}
            disabled={disabled}
            aria-describedby={described}
            onInput={(e) => onChange(e.currentTarget.value.split('\n'))}
          />
        </div>
      );
    case 'image':
      return <ImageField field={field} value={text} siblings={siblings} onChange={onChange} disabled={disabled} id={id} csrf={csrf} />;
    case 'group':
      return (
        <fieldset class="admin-card flex flex-col gap-4">
          <legend class="px-1 font-semibold">{field.label}</legend>
          <Hint field={field} id={id} />
          <FieldList fields={field.fields} value={(value as Data) ?? blank(field.fields)} onChange={(v) => onChange(v)} disabled={disabled} path={id} csrf={csrf} />
        </fieldset>
      );
    case 'list': {
      const items = Array.isArray(value) ? (value as Data[]) : [];
      const set = (next: Data[]) => onChange(next);
      return (
        <fieldset class="admin-card flex flex-col gap-4">
          <legend class="px-1 font-semibold">{field.label}</legend>
          <Hint field={field} id={id} />
          {items.length === 0 && <p class="text-sm text-muted">None yet.</p>}
          {items.map((item, i) => (
            <div class="list-item rounded-xl border border-line p-4" key={i}>
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-muted">{field.itemLabel} {i + 1}</span>
                {!disabled && (
                  <span class="flex gap-1">
                    <button type="button" class="admin-btn" disabled={i === 0} aria-label={`Move ${field.itemLabel} ${i + 1} up`} onClick={() => set(swap(items, i, i - 1))}>↑</button>
                    <button type="button" class="admin-btn" disabled={i === items.length - 1} aria-label={`Move ${field.itemLabel} ${i + 1} down`} onClick={() => set(swap(items, i, i + 1))}>↓</button>
                    <button type="button" class="admin-btn admin-btn--danger" aria-label={`Remove ${field.itemLabel} ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))}>Remove</button>
                  </span>
                )}
              </div>
              <div class="flex flex-col gap-4">
                <FieldList fields={field.fields} value={item} onChange={(v) => set(items.map((x, j) => (j === i ? v : x)))} disabled={disabled} path={`${id}-${i}`} csrf={csrf} />
              </div>
            </div>
          ))}
          {!disabled && (
            <button type="button" class="admin-btn self-start" onClick={() => set([...items, forEditor(field.fields, blank(field.fields))])}>
              + Add {field.itemLabel.toLowerCase()}
            </button>
          )}
        </fieldset>
      );
    }
  }
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
}

const MAX_SIDE = 1600;

/** Resizes the photo in the browser before upload, so large camera files never reach the server. */
async function resize(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('This browser could not process the image.');
  return { blob, width, height };
}

function ImageField({ field, value, siblings, onChange, disabled, id, csrf }: Omit<FieldProps, 'value'> & { value: string }) {
  const altKey = `${field.name}Alt`;
  const [alt, setAlt] = useState(typeof siblings[altKey] === 'string' ? (siblings[altKey] as string) : '');
  const [status, setStatus] = useState<string | null>(null);

  async function upload(file: File) {
    if (alt.trim().length < 3) {
      setStatus('Describe the image first (for people who cannot see it).');
      return;
    }
    setStatus('Uploading…');
    try {
      const { blob, width, height } = await resize(file);
      const form = new FormData();
      form.append('file', new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }));
      form.append('alt', alt);
      form.append('width', String(width));
      form.append('height', String(height));
      const response = await fetch('/api/admin/media', { method: 'POST', headers: { 'X-CSRF-Token': csrf }, body: form });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? 'Upload failed.');
      onChange(body.url, altKey in siblings ? { [altKey]: alt } : {});
      setStatus('Uploaded. Save the draft to keep it.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  return (
    <div class="field">
      <span class="admin-label">{field.label}</span>
      <Hint field={field} id={id} />
      <div class="flex flex-wrap items-start gap-4">
        {value ? <img src={value} alt={alt} width="96" height="96" class="size-24 rounded-xl border border-line object-cover" /> : <div class="grid size-24 place-items-center rounded-xl border border-dashed border-line-strong text-xs text-muted">No image</div>}
        {!disabled && (
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <label for={`${id}-alt`} class="text-sm font-medium">Image description</label>
            <input id={`${id}-alt`} class="admin-input" value={alt} onInput={(e) => setAlt(e.currentTarget.value)} />
            <label for={`${id}-file`} class="text-sm font-medium">Choose a photo (JPG, PNG, WebP or AVIF, under 5 MB)</label>
            <input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => e.currentTarget.files?.[0] && upload(e.currentTarget.files[0])} />
            {value && <button type="button" class="admin-btn self-start" onClick={() => onChange('')}>Remove image</button>}
            {status && <p class="text-sm text-muted" role="status">{status}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
