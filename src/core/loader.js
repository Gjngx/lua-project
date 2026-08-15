import { gsap, ScrollTrigger } from './gsap.js';
import { smoothScroll } from './lenis.js';
import { PageManagerRegistry } from './page-managers.js';

class Loader {
	constructor() {
		this.isLoaded = sessionStorage.getItem('isLoaded') === 'true';
		this.data = null;
		this.manager = null;
		this.isInitialized = false;
		this.tlFirstLoad = null;
		this.tlMove = null;
		this.tlEnd = null;
		this.tlLoading = null;
		this.tlLoadMaster = null;
	}

	async init(data) {
		if (this.isInitialized) return;

		this.data = data;
		this.manager = PageManagerRegistry[data.next.namespace] || null;
		this.isInitialized = true;

		document.documentElement.classList.add('is-loading');
		smoothScroll.stop();
		this.setupTimelines();

		// Dựng DOM state, listeners và các timeline paused của page trước khi
		// loader được play. Không chạy reveal animation tại bước này.
		await this.manager?.prepareOnce(data);
	}

	setupTimelines() {
		this.killTimelines();

		this.tlFirstLoad = gsap.timeline({ paused: true });
		this.tlMove = gsap.timeline({ paused: true });
		this.tlEnd = gsap.timeline({ paused: true });

		this.tlLoading = gsap.timeline({ paused: true });
		this.tlLoading
			.add(this.tlFirstLoad, 0)
			.add(this.tlMove, '>')
			.add(this.tlEnd, '>');

		this.tlLoadMaster = gsap.timeline({
			paused: true,
			onComplete: () => this.complete(),
		});
		this.tlLoadMaster.add(this.tlLoading, 0);
	}

	play() {
		if (!this.isInitialized) return;

		// Timeline hiện đang rỗng. Khi có tween được thêm vào các timeline con,
		// master timeline sẽ tự điều phối toàn bộ loader.
		if (this.tlLoadMaster?.totalDuration() > 0) {
			this.tlLoadMaster.play(0);
		} else {
			this.complete();
		}
	}

	complete() {
		this.restorePage();
		this.manager?.playOnce(this.data);

		this.isLoaded = true;
		sessionStorage.setItem('isLoaded', 'true');
	}

	restorePage() {
		document.documentElement.classList.remove('is-loading');
		smoothScroll.start();
		smoothScroll.lenis?.resize();
		ScrollTrigger.refresh();
	}

	killTimelines() {
		this.tlLoadMaster?.kill();
		this.tlLoading?.kill();
		this.tlFirstLoad?.kill();
		this.tlMove?.kill();
		this.tlEnd?.kill();
	}
}

export const loader = new Loader();
