// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

import sanity from '@sanity/astro';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
const site = process.env.SITE_URL || env.SITE_URL || 'http://localhost:4321';

if (process.env.VERCEL_ENV === 'production' && new URL(site).hostname === 'localhost') {
	throw new Error('SITE_URL must be set to the public HTTPS URL for production deployments.');
}

// https://astro.build/config
export default defineConfig({
	site,
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
