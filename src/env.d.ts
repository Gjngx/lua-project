/// <reference types="astro/client" />
/// <reference types="@sanity/astro/module" />

interface ImportMetaEnv {
	readonly SANITY_API_READ_TOKEN?: string;
	readonly APP_PASSWORD_HASH?: string;
	readonly AUTH_SECRET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
