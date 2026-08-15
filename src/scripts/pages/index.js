export const pageLoaders = {
	home: () => import('./home'),
	about: () => import('./about'),
	letTalk: () => import('./let-talk'),
};

export const pageNamespaces = Object.keys(pageLoaders);
