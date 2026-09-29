import { defineMiddleware } from 'astro:middleware';
import { AUTH_COOKIE, hasValidAuthConfig, verifySession } from './lib/auth';

export const onRequest = defineMiddleware(async ({ cookies, redirect, url }, next) => {
	const passwordHash = import.meta.env.APP_PASSWORD_HASH || process.env.APP_PASSWORD_HASH;
	const secret = import.meta.env.AUTH_SECRET || process.env.AUTH_SECRET;

	if (!hasValidAuthConfig(passwordHash, secret)) {
		return new Response('Server misconfigured: invalid authentication environment variables', {
			status: 503,
		});
	}

	if (url.pathname === '/login') return next();

	const cookie = cookies.get(AUTH_COOKIE)?.value;
	if (!cookie || !(await verifySession(cookie, secret!))) {
		const returnTo = `${url.pathname}${url.search}`;
		return redirect(`/login?next=${encodeURIComponent(returnTo)}`, 302);
	}

	const response = await next();
	response.headers.set('Cache-Control', 'private, no-store');
	response.headers.append('Vary', 'Cookie');
	return response;
});
