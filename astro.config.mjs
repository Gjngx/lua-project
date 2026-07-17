// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import sanity from '@sanity/astro';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com', // Thay bằng domain thật khi deploy
  integrations: [
    sitemap(),
    sanity({
      projectId: process.env.PUBLIC_SANITY_PROJECT_ID || env.PUBLIC_SANITY_PROJECT_ID,
      dataset: process.env.PUBLIC_SANITY_DATASET || env.PUBLIC_SANITY_DATASET || 'production',
      apiVersion: '2024-03-01',
      useCdn: false,
    }),
  ],
});