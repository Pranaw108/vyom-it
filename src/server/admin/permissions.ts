// Role-based access (SOW MOD-I permission matrix). The server checks these on every action;
// the UI only hides what a role cannot do.

export const ROLES = ['owner', 'content_manager', 'contributor', 'sales', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  content_manager: 'Content manager',
  contributor: 'Contributor',
  sales: 'Sales',
  viewer: 'Viewer',
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

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    'dashboard.view', 'content.view', 'content.edit', 'content.submit', 'content.publish', 'team.edit', 'media.upload',
    'leads.view', 'leads.update', 'leads.export', 'leads.erase', 'settings.edit', 'users.manage', 'audit.view',
  ],
  content_manager: ['dashboard.view', 'content.view', 'content.edit', 'content.submit', 'content.publish', 'team.edit', 'media.upload'],
  contributor: ['dashboard.view', 'content.view', 'content.edit', 'content.submit', 'media.upload'],
  sales: ['dashboard.view', 'leads.view', 'leads.update'],
  viewer: ['dashboard.view', 'content.view'],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
