export const pageLoaders = {
	home: () => import('./home'),
	about: () => import('./about'),
	talk: () => import('./let-talk'),
};

export const pageNamespaces = Object.keys(pageLoaders);
