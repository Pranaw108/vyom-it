// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// SITE_URL is set per environment (preview, production); see docs/ENVIRONMENT.md.
const siteUrl = process.env.SITE_URL ?? 'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  trailingSlash: 'never',
  // No visitor sessions are needed; the admin uses Cloudflare Access instead.
  session: false,
  // Content Security Policy (FR-131). Astro hashes every script and style it emits, so only
  // our own code and the two Cloudflare services we use (Turnstile, Web Analytics) can run.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com",
        'frame-src https://challenges.cloudflare.com',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://challenges.cloudflare.com', 'https://static.cloudflareinsights.com'],
      },
      styleDirective: {
        // Inline style attributes carry animation timings (e.g. --rise-index); no inline <style> needs this.
        resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
  },
  build: { format: 'file' },
  // No code blocks on the site; Shiki's inline styles would conflict with the CSP.
  markdown: { syntaxHighlight: false },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    preact(),
    sitemap({ filter: (page) => !page.includes('/admin') && !page.includes('/api/') }),
  ],
  // Images are optimised at build time, so no paid image service is needed.
  adapter: cloudflare({ imageService: 'compile' }),
});
