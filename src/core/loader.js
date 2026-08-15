import { gsap, ScrollTrigger, CustomEase } from './gsap.js';
import { smoothScroll } from './lenis.js';
import { PageManagerRegistry } from './page-managers.js';
import { useSplitPretext } from '../utils/pretext.js';

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
		this.loaderEl = null;
		this.descSplit = null;
	}

	async init(data) {
		if (this.isInitialized) return;
		this.loaderEl = document.querySelector('.loader');
		this.data = data;
		this.manager = PageManagerRegistry[data.next.namespace] || null;
		this.isInitialized = true;

		document.documentElement.classList.add('is-loading');
		document.documentElement.classList.remove('done');
		this.loaderEl?.classList.remove('done');
		this.loaderEl?.classList.add('is-loading');
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

		const isHome = this.data.next.namespace === 'home';
		if (isHome) {
			const progress = this.loaderEl.querySelector('.loader-home-progress');
			const percent = this.loaderEl.querySelector('.loader-home-progress-percent');
			const percentText = percent.querySelector('.loader-home-progress-tens .txt');
			const percentHeight = percentText?.getBoundingClientRect().height || 0;
			const units = percent.querySelector('.loader-home-progress-units');
			const tens = percent.querySelector('.loader-home-progress-tens');
			const logos = Array.from(this.loaderEl.querySelectorAll('.loader-home-logo'));
			const logoIcons = logos.map((item) => item.querySelector('.loader-home-logo-ic'));
			const logo = this.loaderEl.querySelector('.loader-home-logo.is-dark');
			const logoIcon = logo.querySelector('.loader-home-logo-ic');
			const screenLogoIcon = document.querySelector('.header-logo-ic-amin');
			const logoSvg = logoIcon.querySelector('svg');
			const logoPartGroups = ['h', 'i', 'e', 'u', 'mark'].map((part) =>
				logos
					.map((item) => item.querySelector(`.logo-part-${part}`))
					.filter(Boolean),
			);
			const logoPartRotations = [0, 8, -7, 5, -4];
			const logoPartLags = [-7, -13, -10, -15, -18];
			const logoParts = logoPartGroups.flat();
			const screenLogoSvg = screenLogoIcon?.querySelector('svg');
			const darkLogoMask = this.loaderEl.querySelector('.loader-home-logo-mask-dark');
			const brandLogoMask = this.loaderEl.querySelector('.loader-home-logo-mask-brand');
			const desc = this.loaderEl.querySelector('.loader-home-desc');
			const loaderHomePanel = this.loaderEl.querySelector('.loader-home-panel');
			const progressStartY = window.innerHeight - percentHeight;
			const logoRiseStartY = Math.max(
				0,
				percentHeight - logo.getBoundingClientRect().top,
			);
			const logoOffset = { x: 0, y: 0 };
			const logoRevealProgress = { value: 0 };
			const updateLogoReveal = () => {
				const travelled = percentHeight * logoRevealProgress.value;
				gsap.set(percent, { y: -travelled });
				gsap.set(logoIcons, {
					y: Math.max(0, logoRiseStartY - travelled),
				});
			};
			const updateLogoOffset = () => {
				if (!logoSvg || !screenLogoSvg) return;

				// Đo trực tiếp hai SVG sau khi logo loader đã mọc về yPercent: 0.
				// Hai SVG dùng cùng kích thước; phép đo này giữ điểm chồng khít
				// kể cả khi viewport hoặc grid thay đổi.
				const loaderRect = logoSvg.getBoundingClientRect();
				const screenRect = screenLogoSvg.getBoundingClientRect();
				logoOffset.x = screenRect.left - loaderRect.left;
				logoOffset.y = screenRect.top - loaderRect.top;
			};
			this.descSplit = useSplitPretext({
				selector: desc.querySelector('.txt'),
				type: 'lines',
				isMask: true,
			});

			gsap.set(progress, {
				height: percentHeight,
				y: progressStartY,
				autoAlpha: 1
			});
			gsap.set(percent, {
				y: percentHeight,
			});
			const initialCounterIndex = 60;
			gsap.set([tens, units], { y: -percentHeight * initialCounterIndex });
			gsap.set(logoIcons, {
				y: logoRiseStartY,
				autoAlpha: 1
			});
			gsap.set(screenLogoIcon, { autoAlpha: 0 });
			gsap.set(logos, { x: 0, y: 0 });
			gsap.set(logoParts, {
				x: 0,
				y: 0,
				rotation: 0,
				transformOrigin: '50% 50%',
			});
			gsap.set(desc, { autoAlpha: 1 });
			gsap.set(this.descSplit?.elements || [], {
				yPercent: 110,
				autoAlpha: 0,
			});
			this.tlFirstLoad.to(percent, { y: 0, duration: 0.6, ease: 'power3.inOut' });
			this.tlFirstLoad.addLabel('counterStart');
			this.tlFirstLoad.to(this.descSplit?.elements || [], {
				yPercent: 0,
				autoAlpha: 1,
				duration: 0.9,
				ease: 'power3.out',
				stagger: 0.12,
			}, 'counterStart');

			const counterDuration = 8;
			const fakeLoadingEase = CustomEase.create(
				'loaderProgress',
				'M0,0 C0.08,0.24 0.16,0.3 0.28,0.34 C0.4,0.38 0.43,0.62 0.56,0.68 C0.69,0.74 0.74,0.78 0.82,0.84 C0.9,0.9 0.93,0.98 1,1',
			);
			const getCounterTime = (value) => {
				const targetProgress = value / 100;
				let low = 0;
				let high = 1;
				for (let iteration = 0; iteration < 16; iteration += 1) {
					const middle = (low + high) / 2;
					if (fakeLoadingEase(middle) < targetProgress) low = middle;
					else high = middle;
				}
				return ((low + high) / 2) * counterDuration;
			};

			this.tlFirstLoad.to(progress, {
				y: 0,
				duration: getCounterTime(90),
				// Giữ chuyển động đến khi counter chạm khoảng 90 thay vì
				// gần như hoàn tất ngay từ mốc 40 như expo.out.
				ease: 'power2.inOut',
			}, 'counterStart');

			// Mat Voyce-style counter: lấy mẫu tiến độ theo từng nhịp thay vì
			// cuộn qua mọi số. Hai reel luôn chạy ngược hướng và đổi hướng cho
			// nhau ở nhịp kế tiếp, kể cả khi digit đích không thay đổi.
			const counterStepDuration = 1.2;
			const counterSampleTimes = [0.85, 2.3, 3.75, 5.2];
			let displayedCounter = 0;
			const counterSamples = counterSampleTimes.map((time) => {
				const targetCounter = Math.min(
					99,
					Math.round(fakeLoadingEase(time / counterDuration) * 100),
				);
				displayedCounter = Math.min(
					targetCounter,
					displayedCounter + 35,
				);
				return { time, value: displayedCounter };
			});
			counterSamples.push({ time: 7.4, value: 99 });
			let tensReelIndex = initialCounterIndex;
			let unitsReelIndex = initialCounterIndex;
			const getDirectionalIndex = (currentIndex, targetDigit, direction) => {
				const currentDigit = ((currentIndex % 10) + 10) % 10;
				let distance = direction === 1
					? (targetDigit - currentDigit + 10) % 10
					: (currentDigit - targetDigit + 10) % 10;
				if (distance === 0) distance = 10;
				return currentIndex + direction * distance;
			};

			counterSamples.forEach(({ time, value }, index) => {
				const digits = String(value).padStart(2, '0').split('').map(Number);
				const tensDirection = index % 2 === 0 ? 1 : -1;
				const unitsDirection = -tensDirection;
				tensReelIndex = getDirectionalIndex(tensReelIndex, digits[0], tensDirection);
				unitsReelIndex = getDirectionalIndex(unitsReelIndex, digits[1], unitsDirection);
				const position = `counterStart+=${time}`;

				this.tlFirstLoad.to(tens, {
					y: -percentHeight * tensReelIndex,
					duration: counterStepDuration,
					ease: 'power3.inOut',
					overwrite: 'auto',
					force3D: true,
				}, position);
				this.tlFirstLoad.to(units, {
					y: -percentHeight * unitsReelIndex,
					duration: counterStepDuration,
					ease: 'power3.inOut',
					overwrite: 'auto',
					force3D: true,
				}, position);
			});

			this.tlFirstLoad.to(logoRevealProgress, {
				value: 1,
				duration: 1.55,
				ease: 'power3.inOut',
				onUpdate: updateLogoReveal,
				onComplete: updateLogoReveal,
			}, 'counterStart+=8.6');
			this.tlFirstLoad.set(logos, { overflow: 'visible' }, '>');
			this.tlFirstLoad.call(updateLogoOffset, null, '>');

			// Di chuyển toàn bộ SVG bằng tọa độ màn hình để điểm đáp luôn trùng
			// chính xác với logo trên hero. Path chỉ nhận offset cục bộ để tạo độ
			// trễ; mọi offset phải trở về 0 trước khi đổi sang logo thật.
			this.tlEnd.to(logos, {
				x: () => logoOffset.x,
				y: () => logoOffset.y,
				duration: 1.6,
				ease: 'power2.inOut',
				force3D: true,
			}, 0);
			logoPartGroups.forEach((parts, index) => {
				const partStart = index * 0.045;
				this.tlEnd.to(parts, {
					keyframes: [
						{
							y: logoPartLags[index],
							duration: 0.32,
							ease: 'power1.out',
						},
						{
							y: 0,
							duration: 1.28,
							ease: 'power2.inOut',
						},
					],
				}, partStart);

				if (logoPartRotations[index] !== 0) {
					this.tlEnd.to(parts, {
						rotation: logoPartRotations[index],
						duration: 0.7,
						ease: 'power2.out',
					}, partStart);
					this.tlEnd.to(parts, {
						rotation: 0,
						duration: 0.9,
						ease: 'power2.inOut',
					}, partStart + 0.7);
				}
			});
			this.tlEnd.addLabel('logoSwap', 1.8);
			this.tlEnd.set([darkLogoMask, brandLogoMask], { autoAlpha: 0 }, 'logoSwap');
			this.tlEnd.set(screenLogoIcon, { autoAlpha: 1 }, 'logoSwap');
			this.tlEnd.to([loaderHomePanel, darkLogoMask], {
				clipPath: 'inset(0 0 100% 0)',
				duration: 1.6,
				ease: 'power3.inOut',
			}, 0.35);
			this.tlEnd.to(brandLogoMask, {
				clipPath: 'inset(0% 0 0 0)',
				duration: 1.6,
				ease: 'power3.inOut',
			}, 0.35);
			this.tlEnd.set(this.loaderEl, {
				autoAlpha: 0,
				pointerEvents: 'none',
			}, '>');
		}

		this.tlLoading = gsap.timeline({ paused: true });
		[
			this.tlFirstLoad,
			this.tlMove,
			this.tlEnd,
		].forEach((timeline) => {
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
			this.tlLoadMaster.to(this.tlLoading, {
				progress: 1,
				duration: loadingDuration,
				ease: 'none',
			}, 0);
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
		gsap.set(this.loaderEl, { autoAlpha: 0, pointerEvents: 'none' });
		this.loaderEl?.classList.remove('is-loading');
		this.loaderEl?.classList.add('done');
		document.documentElement.classList.add('done');
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
