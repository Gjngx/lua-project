// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import sanity from '@sanity/astro';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com', // Thay bằng domain thật khi deploy
  integrations: [
    sitemap(),
    sanity({
      projectId: 'bw57chik',
      dataset: 'production',
      apiVersion: '2024-03-01',
      useCdn: false,
    }),
  ],
});