export const pageLoaders = {
	home: () => import('./home'),
	about: () => import('./about'),
};

export const pageNamespaces = Object.keys(pageLoaders);
