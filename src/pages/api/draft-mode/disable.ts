import { perspectiveCookieName } from '@sanity/preview-url-secret/constants';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
	const expired = [`${perspectiveCookieName}=`, 'Path=/', 'Secure', 'SameSite=None', 'Max-Age=0'];
	const headers = new Headers();
	headers.append('Set-Cookie', expired.join('; '));
	headers.append('Set-Cookie', [...expired, 'Partitioned'].join('; '));
	headers.set('Location', '/');

	return new Response(null, { status: 307, headers });
};
