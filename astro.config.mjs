// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

import sanity from '@sanity/astro';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

// https://astro.build/config
export default defineConfig({
	site: process.env.SITE_URL || env.SITE_URL || 'http://localhost:4321',
	output: 'server',
	adapter: vercel(),
	devToolbar: {
		enabled: false,
	},
	integrations: [
		sitemap(),
		sanity({
			projectId: process.env.PUBLIC_SANITY_PROJECT_ID || env.PUBLIC_SANITY_PROJECT_ID,
			dataset: process.env.SANITY_DATASET || env.SANITY_DATASET || 'production',
			apiVersion: '2024-03-01',
			useCdn: false,
			stega: {
				studioUrl: env.SANITY_STUDIO_URL || 'http://localhost:3333',
			},
		}),
		react(),
	],
	vite: {
		optimizeDeps: {
			include: [
				'react/compiler-runtime',
				'lodash/isObject.js',
				'lodash/groupBy.js',
				'lodash/keyBy.js',
				'lodash/partition.js',
				'lodash/sortedIndex.js',
			],
		},
	},
});
