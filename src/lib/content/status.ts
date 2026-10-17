// One definition of how a content item's state is described everywhere in the admin.
export interface EntryState {
  published: unknown | null;
  reviewStatus: 'draft' | 'in_review' | 'clean';
}

export function describeState(entry: EntryState): { label: string; tone: 'good' | 'warn' | 'info' | 'muted' } {
  if (entry.reviewStatus === 'in_review') return { label: 'In review', tone: 'info' };
  if (!entry.published) return { label: 'Not live', tone: 'muted' };
  if (entry.reviewStatus === 'draft') return { label: 'Live · unpublished changes', tone: 'warn' };
  return { label: 'Live', tone: 'good' };
}
