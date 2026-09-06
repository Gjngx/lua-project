import { stegaClean } from '@sanity/client/stega';
import { loadQuery } from './load-query';
import { SITE_SOCIAL_LINKS_QUERY } from './queries';

type SocialLinks = Partial<Record<keyof typeof defaultLinks, string | null>>;

const defaultLinks = {
	linkedin: 'https://www.linkedin.com/in/minhhieu-design/',
	instagram: 'https://www.instagram.com/minhhieu_design/',
	facebook: 'https://www.facebook.com/felixnmhieu/',
	dribbble: 'https://dribbble.com/minhhieu-design',
};

export async function loadSocialLinks(draftModeProps: { perspectiveCookie?: string }) {
	const { data } = await loadQuery<SocialLinks | null>({
		query: SITE_SOCIAL_LINKS_QUERY,
		...draftModeProps,
	});

	return (platform: keyof typeof defaultLinks) => stegaClean(
		data?.[platform] ?? defaultLinks[platform],
	) || '#';
}
