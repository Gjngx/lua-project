import { gsap, ScrollTrigger, CustomEase } from './gsap.js';
import { smoothScroll } from './lenis.js';
import { PageManagerRegistry } from './page-managers.js';
import { useSplitPretext } from '../utils/pretext.js';

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
		this.descSplit = null;
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
		if (isHome && !this.isLoaded) {
			const isMobile = window.matchMedia('(max-width: 767px)').matches;
			const progress = $(this.loaderEl).find('.loader-home-progress')[0];
			const percent = $(this.loaderEl).find('.loader-home-progress-percent')[0];
			const percentText = $(percent).find('.loader-home-progress-tens .txt')[0];
			const percentHeight = percentText?.getBoundingClientRect().height || 0;
			const units = $(percent).find('.loader-home-progress-units')[0];
			const tens = $(percent).find('.loader-home-progress-tens')[0];
			const logos = Array.from($(this.loaderEl).find('.loader-home-logo').toArray());
			const logoIcons = logos.map((item) => $(item).find('.loader-home-logo-ic')[0]);
			const logo = $(this.loaderEl).find('.loader-home-logo.is-dark')[0];
			const logoIcon = $(logo).find('.loader-home-logo-ic')[0];
			const screenLogoIcon = $('.header-logo-ic-amin')[0];
			const logoSvg = $(logoIcon).find('svg')[0];
			const logoPartGroups = ['h', 'i', 'e', 'u', 'mark'].map((part) =>
				logos
					.map((item) => $(item).find(`.logo-part-${part}`)[0])
					.filter(Boolean),
			);
			const logoPartRotations = [0, 8, -7, 5, -4];
			const logoPartLags = [-7, -13, -10, -15, -18];
			const logoParts = logoPartGroups.flat();
			const screenLogoSvg = $(screenLogoIcon).find('svg')[0];
			const darkLogoMask = $(this.loaderEl).find('.loader-home-logo-mask-dark')[0];
			const brandLogoMask = $(this.loaderEl).find('.loader-home-logo-mask-brand')[0];
			const desc = $(this.loaderEl).find('.loader-home-desc')[0];
			const loaderHomePanel = $(this.loaderEl).find('.loader-home-panel')[0];
			const progressStartY = window.innerHeight - percentHeight;
			const logoRiseStartY = isMobile
				? percentHeight
				: Math.max(0, percentHeight - logo.getBoundingClientRect().top);
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
				selector: $(desc).find('.txt')[0],
				type: 'lines',
				isMask: true,
			});

			gsap.set(progress, {
				height: percentHeight,
				y: progressStartY,
				autoAlpha: 1
			});
			gsap.set(percent, {
				y: percentHeight
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
			});
			// Chỉ cần thay đổi giá trị này để chỉnh toàn bộ thời gian chạy counter.
			const totalDuration = 6;
			const counterStartTime = 0.3;
			const counterPauseDuration = 0.3;
			const finalCounterPauseDuration = 0.2;
			const fakeLoadingEase = CustomEase.create(
				'loaderProgress',
				'M0,0 C0.08,0.24 0.16,0.3 0.28,0.34 C0.4,0.38 0.43,0.62 0.56,0.68 C0.69,0.74 0.74,0.78 0.82,0.84 C0.9,0.9 0.93,0.98 1,1',
			);

			// Mốc đầu và cuối được random; mốc giữa luôn dừng tại 50%.
			// Tại mỗi mốc, cả progress và hai reel cùng nghỉ một nhịp.
			const counterStopTimes = [
				gsap.utils.random(totalDuration * 0.2, totalDuration * 0.35, 0.1),
				totalDuration * 0.5,
				gsap.utils.random(totalDuration * 0.78, totalDuration * 0.88, 0.1),
			];
			const counterStopValues = [
				gsap.utils.random(20, 35, 1),
				50,
				gsap.utils.random(70, 85, 1),
			];
			const counterSamples = counterStopTimes.map((time, index) => {
				const isMiddleStop = index === 1;
				const progressValue = isMiddleStop
					? 0.5
					: fakeLoadingEase(time / totalDuration);
				return {
					time,
					value: counterStopValues[index],
					progressValue,
				};
			});
			counterSamples.push({
				time: totalDuration,
				value: 99,
				progressValue: 1,
			});
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

			const firstLoadTimeline = this.tlFirstLoad
				.to(percent, {
					y: 0,
					duration: 0.4,
					ease: 'sine.inOut',
				})
				.to(this.descSplit?.elements || [], {
					yPercent: 0,
					duration: 0.4,
					ease: 'sine.inOut',
					stagger: 0.02,
				}, '<');

			let previousStopTime = 0;
			const counterTimeline = counterSamples.reduce((timeline, sample, index) => {
				const { time, value, progressValue } = sample;
				const digits = String(value).padStart(2, '0').split('').map(Number);
				const tensDirection = index % 2 === 0 ? 1 : -1;
				const unitsDirection = -tensDirection;
				tensReelIndex = getDirectionalIndex(tensReelIndex, digits[0], tensDirection);
				unitsReelIndex = getDirectionalIndex(unitsReelIndex, digits[1], unitsDirection);
				const pauseBefore = index === 0 ? 0 : counterPauseDuration;
				const position = counterStartTime + previousStopTime + pauseBefore;
				const segmentDuration = time - previousStopTime - pauseBefore;
				previousStopTime = time;

				if (!isMobile) {
					timeline.to(progress, {
						y: progressStartY * (1 - progressValue),
						duration: segmentDuration,
						ease: 'power3.inOut',
					}, position);
				}

				return timeline.to(tens, {
					y: -percentHeight * tensReelIndex,
					duration: segmentDuration,
					ease: 'power3.inOut',
					overwrite: 'auto',
					force3D: true,
				}, position).to(units, {
					y: -percentHeight * unitsReelIndex,
					duration: segmentDuration,
					ease: 'power3.inOut',
					overwrite: 'auto',
					force3D: true,
				}, position);
			}, firstLoadTimeline);

			if (isMobile) {
				// Mobile giữ counter ở đáy khi đếm; tới 99, counter và logo
				// nối tiếp trượt lên tại đúng vị trí bottom.
				counterTimeline
					.to(logoRevealProgress, {
						value: 1,
						duration: 0.9,
						ease: 'power3.inOut',
						onUpdate: updateLogoReveal,
						onComplete: updateLogoReveal,
					}, `>+=${finalCounterPauseDuration}`)
					.set(logos, { overflow: 'visible' }, '>');
			} else {
				counterTimeline
					.to(logoRevealProgress, {
						value: 1,
						duration: 0.9,
						ease: 'power3.inOut',
						onUpdate: updateLogoReveal,
						onComplete: updateLogoReveal,
					}, `>+=${finalCounterPauseDuration}`)
					.set(logos, { overflow: 'visible' }, '>')
					.call(updateLogoOffset, null, '>');
			}

			// Di chuyển toàn bộ SVG bằng tọa độ màn hình để điểm đáp luôn trùng
			// chính xác với logo trên hero. Path chỉ nhận offset cục bộ để tạo độ
			// trễ; mọi offset phải trở về 0 trước khi đổi sang logo thật.
			const logoMoveTimeline = isMobile
				? this.tlEnd
				: this.tlEnd.to(logos, {
					x: () => logoOffset.x,
					y: () => logoOffset.y,
					duration: 1.6,
					ease: 'power2.inOut',
					force3D: true,
				}, 0);
			const logoEndTimeline = isMobile
				? logoMoveTimeline
				: logoPartGroups.reduce((timeline, parts, index) => {
					const partStart = index * 0.045;
					const partTimeline = timeline.to(parts, {
						keyframes: [
							{
								y: logoPartLags[index],
								duration: 0.32,
								ease: 'power4.inOut',
							},
							{
								y: 0,
								duration: 0.5,
								ease: 'power3.inOut',
							},
						],
					}, partStart);

					if (logoPartRotations[index] === 0) return partTimeline;

					return partTimeline.to(parts, {
						rotation: logoPartRotations[index],
						duration: 0.7,
						ease: 'power2.out',
					}, partStart).to(parts, {
						rotation: 0,
						duration: 0.9,
						ease: 'power2.inOut',
					}, partStart + 0.7);
				}, logoMoveTimeline);

			logoEndTimeline.addLabel('logoSwap', 1.8)
				.set([darkLogoMask, brandLogoMask], { autoAlpha: 0 }, 'logoSwap')
				.set(screenLogoIcon, { autoAlpha: 1 }, 'logoSwap')
				.to([loaderHomePanel, darkLogoMask], {
				clipPath: 'inset(0 0 100% 0)',
				duration: 0.8,
				ease: 'power4.inOut',
			}, 0.35)
				.call(() => this.playPageOnce(), null, 0.35)
				.to(brandLogoMask, {
				clipPath: 'inset(0% 0 0 0)',
				duration: 0.8,
				ease: 'power4.inOut',
			}, 0.35)
				.set(this.loaderEl, {
				autoAlpha: 0,
				pointerEvents: 'none',
			}, 'logoSwap');
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
		$(this.loaderEl).removeClass(['is-loading']);
		$(this.loaderEl).addClass(['done']);
		$(document.documentElement).addClass(['done']);
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
