import { validatePreviewUrl } from '@sanity/preview-url-secret';
import { perspectiveCookieName } from '@sanity/preview-url-secret/constants';
import type { APIRoute } from 'astro';
import { sanityClient } from 'sanity:client';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
	const token = import.meta.env.SANITY_API_READ_TOKEN;

	if (!token) {
		return new Response('Server misconfigured: missing SANITY_API_READ_TOKEN', { status: 500 });
	}

	const {
		isValid,
		redirectTo = '/',
		studioPreviewPerspective,
	} = await validatePreviewUrl(sanityClient.withConfig({ token }), request.url);

	if (!isValid) return new Response('Invalid preview secret', { status: 401 });

	const partitioned =
		request.headers.get('sec-fetch-dest') === 'iframe' &&
		request.headers.get('sec-fetch-site') === 'cross-site';

	cookies.set(perspectiveCookieName, studioPreviewPerspective ?? 'drafts', {
		httpOnly: false,
		sameSite: 'none',
		secure: true,
		path: '/',
		partitioned,
	});

	return redirect(redirectTo, 307);
};
