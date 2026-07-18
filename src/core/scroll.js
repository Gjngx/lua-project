import { viewport, getAllScrollTrigger } from './helpers.js';
import { smoothScroll } from './lenis.js';

export function scrollTop(onComplete) {
	if ("scrollRestoration" in history) {
		history.scrollRestoration = "manual";
	}
	window.scrollTo(0, 0);
	if (viewport.w <= 767) {
		const bodyInner = document.querySelector('.body-inner');
		if (bodyInner) bodyInner.scrollTop = 0;
	}
	smoothScroll.scrollToTop({
		onComplete: () => {
			onComplete?.();
			getAllScrollTrigger("refresh");
		},
	});
}
