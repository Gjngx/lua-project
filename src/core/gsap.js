import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, CustomEase);

// Mobile Safari fires resize events while its browser chrome expands/collapses.
// Ignore those height-only changes so scrubbed timelines keep stable geometry.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, CustomEase };
