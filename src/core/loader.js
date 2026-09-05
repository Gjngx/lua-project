import { gsap, ScrollTrigger, CustomEase } from './gsap.js';
import { smoothScroll } from './lenis.js';
import { PageManagerRegistry } from './page-managers.js';

class Loader {
	constructor() {
		this.isLoaded = false;
		this.data = null;
		this.manager = null;
		this.isInitialized = false;
		this.tlFirstLoad = null;
		this.tlMove = null;
		this.tlEnd = null;
		this.tlLoading = null;
		this.tlLoadMaster = null;
		this.loaderEl = null;
		this.hasPlayedPageOnce = false;
	}

	async init(data) {
		if (this.isInitialized) return;
		this.loaderEl = $('.loader')[0];
		this.data = data;
		this.manager = PageManagerRegistry[data.next.namespace] || null;
		this.isInitialized = true;

		$(document.documentElement).addClass(['is-loading']);
		$(document.documentElement).removeClass(['done']);
		$(this.loaderEl).removeClass(['done']);
		$(this.loaderEl).addClass(['is-loading']);
		smoothScroll.stop();
		this.setupTimelines();
		await this.manager?.prepareOnce(data);
	}

	setupTimelines() {
		this.killTimelines();

		this.tlFirstLoad = gsap.timeline({
			paused: true,
			onStart: () => {
				$(this.loaderEl).find('[data-loader-hidden]').removeAttr('data-loader-hidden');
			},
		});
		this.tlMove = gsap.timeline({ paused: true });
		this.tlEnd = gsap.timeline({ paused: true });

		// Viết animation mới vào các timeline trước khi ghép bên dưới.
		// this.tlFirstLoad: animation mở đầu.
		// this.tlMove: animation di chuyển.
		// this.tlEnd: animation kết thúc.

		const isHome = this.data.next.namespace === 'home';
		if (isHome && !this.isLoaded) {
			const progress = $(this.loaderEl).find('.loader-home-progress');
			const maskLoading = $(this.loaderEl).find('.loader-home-logo-mask-dark .loader-home-logo-ic');
			const progressMask = $(this.loaderEl).find('.loader-home-logo-ic.mask-loading');
			const textLoading = $(this.loaderEl).find('.loader-home-loading');
			const loadingDots = textLoading.find('.loader-home-dot').toArray();
			const tens = $(progress).find('.loader-home-progress-tens')[0];
			const units = $(progress).find('.loader-home-progress-units')[0];
			const digitEase = CustomEase.create('loaderDigit', '0.76,0,0.24,1');
			const countStops = [36, 69, 99];
			const digitDuration = 1.2;
			const pauseDuration = 0.15;
			const countDuration = countStops.length * digitDuration + (countStops.length - 1) * pauseDuration;
			const maskEase = (progress) => {
				const time = progress * countDuration;
				const index = Math.min(countStops.length - 1, Math.floor(time / (digitDuration + pauseDuration)));
				const local = Math.min(1, (time - index * (digitDuration + pauseDuration)) / digitDuration);
				const previous = index > 0 ? countStops[index - 1] : 0;
				const eased = (1 - Math.cos(Math.PI * local)) / 2;
				const staged = (previous + (countStops[index] - previous) * eased) / 99;
				// Giảm tốc rõ ở nhịp nghỉ, vẫn giữ chuyển động liên tục.
				return progress * 0.35 + staged * 0.65;
			};
			let tensIndex = 60;
			let unitsIndex = 60;
			const nextDigitIndex = (current, digit, direction) => {
				const currentDigit = current % 10;
				const distance = direction > 0
					? (digit - currentDigit + 10) % 10
					: (currentDigit - digit + 10) % 10;
				return current + direction * (distance || 10);
			};

			gsap.set(tens, { yPercent: -tensIndex * 100 / tens.children.length });
			gsap.set(units, { yPercent: -unitsIndex * 100 / units.children.length });
			gsap.set([progress, maskLoading, textLoading], { yPercent: 100 });
			gsap.set(progressMask, { clipPath: 'inset(0 0 0 0%)', opacity: 1 });
			gsap.set(loadingDots, { opacity: 0 });

			this.tlFirstLoad.to([progress, maskLoading, textLoading], {
				yPercent: 0,
				duration: 0.3,
				ease: 'power1.out',
			});

			const countStart = this.tlFirstLoad.duration();

			// Hai cột luôn ngược chiều và cùng đảo chiều sau mỗi nhịp nghỉ.
			countStops.forEach((value, index) => {
				const direction = index % 2 === 0 ? 1 : -1;
				tensIndex = nextDigitIndex(tensIndex, Math.floor(value / 10), direction);
				unitsIndex = nextDigitIndex(unitsIndex, value % 10, -direction);
				const position = this.tlFirstLoad.duration() + (index > 0 ? pauseDuration : 0);
				this.tlFirstLoad
					.to(tens, {
						yPercent: -tensIndex * 100 / tens.children.length,
						duration: digitDuration,
						ease: digitEase,
					}, position)
					.to(units, {
						yPercent: -unitsIndex * 100 / units.children.length,
						duration: digitDuration,
						ease: digitEase,
					}, position);
				if (loadingDots[index]) {
					this.tlFirstLoad.set(loadingDots[index], { opacity: 1 }, position + digitDuration);
				}
			});
			this.tlFirstLoad.to(progressMask, {
				clipPath: 'inset(0 0 0 100%)',
				duration: countDuration,
				ease: maskEase,
			}, countStart);
			this.tlFirstLoad.set(progressMask, { opacity: 0 }, countStart + countDuration);

			this.tlMove.to($(this.loaderEl).find('.loader-home-panel'), {
				clipPath: 'inset(0 0 100% 0)',
				duration: 1.2,
				ease: 'power3.inOut',
			});

		}


		this.tlLoading = gsap.timeline({ paused: true });
		[this.tlFirstLoad, this.tlMove, this.tlEnd].forEach((timeline) => {
			const duration = timeline.totalDuration();
			if (duration <= 0) return;

			this.tlLoading.to(timeline, {
				progress: 1,
				duration,
				ease: 'none',
			});
		});

		this.tlLoadMaster = gsap.timeline({
			paused: true,
			onComplete: () => this.complete(),
		});
		const loadingDuration = this.tlLoading.totalDuration();
		if (loadingDuration > 0) {
			this.tlLoadMaster.to(
				this.tlLoading,
				{
					progress: 1,
					duration: loadingDuration,
					ease: 'none',
				},
				0,
			);
		}
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
		// gsap.set(this.loaderEl, { autoAlpha: 0, pointerEvents: 'none' });
		// $(this.loaderEl).removeClass(['is-loading']);
		// $(this.loaderEl).addClass(['done']);
		// $(document.documentElement).addClass(['done']);
		this.playPageOnce();

		this.isLoaded = true;
	}

	playPageOnce() {
		if (this.hasPlayedPageOnce) return;
		this.hasPlayedPageOnce = true;
		this.manager?.playOnce(this.data);
	}

	restorePage() {
		$(document.documentElement).removeClass(['is-loading']);
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
