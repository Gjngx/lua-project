import { gsap, ScrollTrigger, CustomEase } from './gsap.js';
import { smoothScroll } from './lenis.js';
import { PageManagerRegistry } from './page-managers.js';

// Chỉnh nhịp loader tại đây. Tất cả thời gian tính bằng giây.
const LOADER_TIMING = {
	introDuration: 0.3, // Logo và bộ đếm xuất hiện.
	countStepDuration: 1.2, // Thời gian chạy mỗi mốc đếm.
	countPauseDuration: 0.1, // Nghỉ giữa các mốc đếm.
	panelDuration: 1.2, // Panel và hai mask màu vuốt cùng nhau.
	tiltDuration: 0.3, // Nghiêng trong lúc trượt; tối đa nửa thời gian trượt mỗi chữ.
	slideStart: 0, // Bắt đầu nghiêng và trượt, tính từ lúc panel bắt đầu vuốt.
	straightenDuration: 0.4, // Thẳng dần ở đoạn cuối, hoàn tất khi chạm điểm đáp.
	// delay cộng vào slideStart; duration là thời gian trượt.
	// Dấu và chữ e dùng chung nhịp; rotation tính bằng độ.
	letters: [
		{ names: ['h'], rotation: 4, delay: 0, duration: 0.4 },
		{ names: ['i'], rotation: 8, delay: 0.06, duration: 0.68 },
		{ names: ['e', 'mark'], rotation: -8, delay: 0.12, duration: 0.76 },
		{ names: ['u'], rotation: 4, delay: 0.18, duration: 0.8 },
	],
};

class Loader {
	constructor() {
		this.isLoaded = false;
		this.data = null;
		this.manager = null;
		this.isInitialized = false;
		this.tlFirstLoad = null;
		this.tlMove = null;
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

		// Viết animation mới vào các timeline trước khi ghép bên dưới.
		// this.tlFirstLoad: animation mở đầu.
		// this.tlMove: animation di chuyển.

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
			const digitDuration = LOADER_TIMING.countStepDuration;
			const pauseDuration = LOADER_TIMING.countPauseDuration;
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
				duration: LOADER_TIMING.introDuration,
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

			const darkMask = $(this.loaderEl).find('.loader-home-logo-mask-dark');
			const brandMask = $(this.loaderEl).find('.loader-home-logo-mask-brand');
			const logos = $(this.loaderEl).find('.loader-home-logo');
			const headerLogo = document.querySelector('.header-logo-ic-amin');
			if (headerLogo) {
				gsap.set(logos.find('.loader-home-logo-ic'), { height: getComputedStyle(headerLogo).height });
				gsap.set(headerLogo, { visibility: 'hidden' });
			}
			const logoParts = logos.find('.logo-part');
			gsap.set(logoParts, { y: 0, rotation: 0, transformOrigin: '50% 50%' });
			gsap.set(darkMask, { clipPath: 'inset(0 0 0% 0)' });
			gsap.set(brandMask, { clipPath: 'inset(100% 0 0 0)' });

			// Cho từng chữ đi ra ngoài khung logo; hai mask vẫn cắt theo mép panel.
			this.tlMove.set([logos, logos.find('.loader-home-logo-ic'), logos.find('svg')], {
				overflow: 'visible',
			}, 0);
			this.tlMove.to([$(this.loaderEl).find('.loader-home-panel'), darkMask], {
				clipPath: 'inset(0 0 100% 0)',
				duration: LOADER_TIMING.panelDuration,
				ease: 'power3.inOut',
			}, 0);
			this.tlMove.to(brandMask, {
				clipPath: 'inset(0% 0 0 0)',
				duration: LOADER_TIMING.panelDuration,
				ease: 'power3.inOut',
			}, 0);

			// SVG dùng đơn vị viewBox: đổi quãng đường xuống đáy từ px sang SVG.
			const slideDistance = (_, part) => {
				const svg = part.ownerSVGElement;
				const logo = part.closest('.loader-home-logo');
				const bottomGap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.4;
				// Khung cố định không chịu transform của animation cuộn trên logo header.
				const landingBottom = headerLogo?.closest('.header-logo-amin')?.getBoundingClientRect().bottom
					?? this.loaderEl.getBoundingClientRect().bottom - bottomGap;
				const distance = Math.max(0, landingBottom - logo.getBoundingClientRect().top - svg.clientHeight);
				return distance * svg.viewBox.baseVal.height / svg.clientHeight;
			};
			LOADER_TIMING.letters.forEach(({ names, rotation, delay, duration }) => {
				const parts = logos.find(names.map((name) => `.logo-part-${name}`).join(', '));
				const slideStart = LOADER_TIMING.slideStart + delay;
				const tiltDuration = Math.min(LOADER_TIMING.tiltDuration, duration / 2);
				const straightenDuration = Math.min(LOADER_TIMING.straightenDuration, duration - tiltDuration);
				const straightenStart = slideStart + duration - straightenDuration;
				this.tlMove.to(parts, { rotation, duration: tiltDuration, ease: 'power1.in' }, slideStart);
				this.tlMove.fromTo(parts, { y: 0 }, {
					y: slideDistance,
					duration,
					ease: 'power1.inOut',
					immediateRender: false,
				}, slideStart);
				this.tlMove.to(parts, {
					rotation: 0,
					duration: straightenDuration,
					ease: 'power2.inOut',
				}, straightenStart);
			});
			if (headerLogo) {
				// Chờ cả panel và tất cả chữ hoàn tất, kể cả khi tăng duration ở trên.
				const moveEnd = this.tlMove.duration();
				this.tlMove.set(headerLogo, { clearProps: 'visibility' }, moveEnd);
				this.tlMove.set(this.loaderEl, { opacity: 0, pointerEvents: 'none' }, moveEnd);
			}

		}


		this.tlLoading = gsap.timeline({ paused: true });
		[this.tlFirstLoad, this.tlMove].forEach((timeline) => {
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
	}
}

export const loader = new Loader();
