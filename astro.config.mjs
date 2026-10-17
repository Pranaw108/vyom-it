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
  build: { format: 'file' },
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
