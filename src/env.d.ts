declare namespace App {
  interface Locals {
    /** Set by middleware for signed-in admin users with an active account. */
    admin?: import('./server/admin/context').AdminContext;
    /** Set by middleware when an admin route is refused, so the no-access page can explain why. */
    adminDenied?: Extract<import('./server/admin/context').AdminResolution, { ok: false }>;
  }
}
