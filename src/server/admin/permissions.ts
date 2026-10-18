// Role-based access (SOW MOD-I permission matrix). The server checks these on every action;
// the UI only hides what a role cannot do.

export const ROLES = ['owner', 'content_manager', 'contributor', 'sales', 'viewer', 'client'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  content_manager: 'Content manager',
  contributor: 'Contributor',
  sales: 'Sales',
  viewer: 'Viewer',
  client: 'Client',
};

export type Permission =
  | 'dashboard.view'
  | 'content.view'
  | 'content.edit'
  | 'content.submit'
  | 'content.publish'
  | 'team.edit'
  | 'media.upload'
  | 'leads.view'
  | 'leads.update'
  | 'leads.export'
  | 'leads.erase'
  | 'settings.edit'
  | 'users.manage'
  | 'audit.view';

const MATRIX: Record<Exclude<Role, 'client'>, Permission[]> = {
  owner: [
    'dashboard.view', 'content.view', 'content.edit', 'content.submit', 'content.publish', 'team.edit', 'media.upload',
    'leads.view', 'leads.update', 'leads.export', 'leads.erase', 'settings.edit', 'users.manage', 'audit.view',
  ],
  content_manager: ['dashboard.view', 'content.view', 'content.edit', 'content.submit', 'content.publish', 'team.edit', 'media.upload'],
  contributor: ['dashboard.view', 'content.view', 'content.edit', 'content.submit', 'media.upload'],
  sales: ['dashboard.view', 'leads.view', 'leads.update'],
  viewer: ['dashboard.view', 'content.view'],
};

/**
 * What an Owner may grant to a Client account, one by one. Owner-only powers (users, site settings,
 * erasing data, the audit log) are deliberately not on this list, so a client can never hold them.
 */
export const CLIENT_GRANTABLE: { permission: Permission; label: string }[] = [
  { permission: 'content.view', label: 'View website content' },
  { permission: 'content.edit', label: 'Edit content drafts' },
  { permission: 'content.submit', label: 'Submit content for review' },
  { permission: 'content.publish', label: 'Publish content' },
  { permission: 'team.edit', label: 'Edit team profiles' },
  { permission: 'media.upload', label: 'Upload images' },
  { permission: 'leads.view', label: 'View leads' },
  { permission: 'leads.update', label: 'Update lead status and notes' },
  { permission: 'leads.export', label: 'Export leads (CSV)' },
];
const GRANTABLE = new Set<Permission>(CLIENT_GRANTABLE.map((g) => g.permission));

export interface Grantee {
  role: Role;
  permissions?: readonly string[];
}

/** Effective permissions: the role's fixed set, or for a client the granted subset (never Owner-only powers). */
export function permissionsOf(user: Grantee): Permission[] {
  if (user.role !== 'client') return MATRIX[user.role];
  const granted = (user.permissions ?? []).filter((p): p is Permission => GRANTABLE.has(p as Permission));
  return ['dashboard.view', ...granted];
}

export function can(user: Grantee | Role, permission: Permission): boolean {
  const grantee = typeof user === 'string' ? { role: user } : user;
  return permissionsOf(grantee).includes(permission);
}

/** Keeps only permissions an Owner is allowed to grant to a client. */
export function sanitiseGrants(values: unknown[]): Permission[] {
  return [...new Set(values.filter((v): v is Permission => typeof v === 'string' && GRANTABLE.has(v as Permission)))];
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
