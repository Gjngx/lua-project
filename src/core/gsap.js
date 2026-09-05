import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, CustomEase, SplitText);

// Mobile Safari fires resize events while its browser chrome expands/collapses.
// Ignore those height-only changes so scrubbed timelines keep stable geometry.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, CustomEase, SplitText };
