import { prepareWithSegments, layoutWithLines, layoutNextLine } from "@chenglou/pretext";

const _prepCache = new Map();
const _wordSeg = new Intl.Segmenter(undefined, { granularity: 'word' });
const _charSeg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const _spanStyleInline = 'display:inline-block;position:relative;text-indent:0';

// ─── Font helpers (no getComputedStyle needed — parse from classes/tags) ───────

// Class-based size overrides (all rem via x/10 convention)
// fs-16 → 1.6rem, fs-20 → 2rem, etc.
const FS_MAP = { 'fs-12': '1.2rem', 'fs-14': '1.4rem', 'fs-16': '1.6rem', 'fs-18': '1.8rem', 'fs-20': '2rem', 'fs-22': '2.2rem', 'fs-24': '2.4rem', 'fs-28': '2.8rem', 'fs-32': '3.2rem', 'fs-36': '3.6rem', 'fs-40': '4rem', 'fs-48': '4.8rem', 'fs-56': '5.6rem', 'fs-64': '6.4rem', 'fs-72': '7.2rem', 'fs-80': '8rem' };
// Class-based weight overrides (matches actual project classes: fw-reg, fw-med, fw-semi, fw-bold)
const FW_MAP = { 'fw-reg': '400', 'fw-med': '500', 'fw-semi': '600', 'fw-bold': '700' };
// Semantic tags that force bold
const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
// Tag → style overrides (bold, italic, underline, etc.)
const TAG_STYLE_MAP = {
	STRONG: { fontWeight: '700' },
	B:      { fontWeight: '700' },
	EM:     { fontStyle: 'italic' },
	I:      { fontStyle: 'italic' },
	U:      { textDecorationLine: 'underline' },
	S:      { textDecorationLine: 'line-through' },
	DEL:    { textDecorationLine: 'line-through' },
	INS:    { textDecorationLine: 'underline' },
	SUB:    { verticalAlign: 'sub' },
	SUP:    { verticalAlign: 'super' },
};

// Build font CSS string for DOM — only weight + size, NO font-family.
// font-family is inherited from CSS cascade so custom fonts apply correctly.
function cssText(fontWeight, fontSize, extra = '') {
	const parts = [];
	if (fontWeight) parts.push(`font-weight:${fontWeight}`);
	if (fontSize) parts.push(`font-size:${fontSize}`);
	if (extra) parts.push(extra);
	return parts.join(';');
}

// ─── Rich Segment Parser ───────────────────────────────────────────────────────

/**
 * Parse HTML into rich segments using ONLY class/tag parsing — zero getComputedStyle in loop.
 * Returns [{ text, cssText, isBreak }]
 */
function parseRichHTML(el, rootFontSize, rootFW = '400') {
	// Sync actual computed display state of <br> tags to the offline clone
	const clonedEl = el.cloneNode(true);
	const originalBrs = el.querySelectorAll('br');
	const clonedBrs = clonedEl.querySelectorAll('br');
	for (let i = 0; i < originalBrs.length; i++) {
		if (window.getComputedStyle(originalBrs[i]).display === 'none') {
			clonedBrs[i].style.display = 'none';
		}
	}

	const segments = [];
	const styleStack = [];

	let curFW = undefined;  // default to undefined to inherit from parent CSS
	let curFS = undefined;  // default to undefined to inherit from parent CSS
	let curExtra = '';  // font-style, text-decoration, etc.
	let curClasses = [];  // non-style classes (e.g. txt-orange, txt-highlight)

	function currentCSS() {
		return cssText(curFW, curFS, curExtra);
	}

	function currentClassName() {
		return [...new Set(curClasses)].join(' ');
	}

	function pushText(text) {
		if (!text) return;
		segments.push({ text, cssText: currentCSS(), className: currentClassName(), domStyle: curExtra, isBreak: false });
	}

	function pushBreak() {
		segments.push({ text: '\n', cssText: '', isBreak: true });
	}

	function saveState() {
		styleStack.push({ fw: curFW, fs: curFS, extra: curExtra, classes: [...curClasses] });
	}

	function restoreState() {
		if (styleStack.length === 0) return;
		const prev = styleStack.pop();
		curFW = prev.fw;
		curFS = prev.fs;
		curExtra = prev.extra;
		curClasses = prev.classes;
	}

	// Parse a single node's className → push style state change if needed
	// Note: saveState() is called by walk() before this, so we just apply overrides
	function applyNode(node) {
		let changed = false;
		const tag = node.tagName;

		// Tag-based overrides (strong, em, etc.)
		const tagOv = TAG_STYLE_MAP[tag];
		if (tagOv) {
			if (tagOv.fontWeight)  { curFW = tagOv.fontWeight;  changed = true; }
			if (tagOv.fontStyle)   { curExtra += `font-style:${tagOv.fontStyle};`; changed = true; }
			if (tagOv.textDecorationLine) { curExtra += `text-decoration:${tagOv.textDecorationLine};`; changed = true; }
			if (tagOv.verticalAlign) { curExtra += `vertical-align:${tagOv.verticalAlign};`; changed = true; }
		}

		// Heading tags → force bold
		if (HEADING_TAGS.has(tag)) {
			curFW = '700';
			changed = true;
		}

		// Class-based overrides (fw-reg, fw-med, fw-semi, fw-bold, fs-*)
		// Non-style classes (e.g. txt-orange) are preserved for output spans
		const cls = node.className || '';
		let standardFS = undefined;
		let tabletFS = undefined;
		let mobileFS = undefined;

		let standardFW = undefined;
		let mobileFW = undefined;

		for (const c of cls.split(/\s+/)) {
			if (!c) continue;

			// Check for FS (font-size)
			if (c.endsWith('-mb') && FS_MAP[c.slice(0, -3)]) {
				mobileFS = FS_MAP[c.slice(0, -3)];
			} else if (c.endsWith('-tb') && FS_MAP[c.slice(0, -3)]) {
				tabletFS = FS_MAP[c.slice(0, -3)];
			} else if (FS_MAP[c]) {
				standardFS = FS_MAP[c];
			}

			// Check for FW (font-weight)
			if (c.endsWith('-mb') && FW_MAP[c.slice(0, -3)]) {
				mobileFW = FW_MAP[c.slice(0, -3)];
			} else if (FW_MAP[c]) {
				standardFW = FW_MAP[c];
			}

			// Always preserve all classes for the DOM!
			curClasses = [...curClasses, c];
			changed = true;
		}

		// Resolve responsive font size based on current viewport width
		let activeFS = undefined;
		const w = window.innerWidth;
		if (w <= 767) {
			activeFS = mobileFS || tabletFS || standardFS;
		} else if (w <= 991) {
			activeFS = tabletFS || standardFS;
		} else {
			activeFS = standardFS;
		}

		if (activeFS !== undefined) {
			curFS = activeFS;
		}

		// Resolve responsive font weight based on current viewport width
		let activeFW = undefined;
		if (w <= 767) {
			activeFW = mobileFW || standardFW;
		} else {
			activeFW = standardFW;
		}

		if (activeFW !== undefined) {
			curFW = activeFW;
		}

		if (!changed) {
			styleStack.pop(); // nothing changed, don't push to stack
		}
	}

	// Self-contained recursive walk — each node handles its own class, then descends.
	// This ensures parent element classes (e.g. <div class="fw-semi">) are always parsed.
	function walk(node) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const tag = node.tagName;
			if (tag === 'BR') {
				if (node.style.display === 'none') return;
				pushBreak();
				return;
			}
			// Save state before applying this node's class, so children inherit it
			saveState();
			applyNode(node);
			// Walk children — they inherit this node's applied styles
			for (const child of node.childNodes) {
				walk(child);
			}
			// Restore after all children are done
			restoreState();
		} else if (node.nodeType === Node.TEXT_NODE) {
			// Collapse whitespace: in HTML, consecutive whitespace (including
			// newlines) is rendered as a single space. Only <br> tags create line breaks.
			const text = (node.textContent || '').replace(/\s+/g, ' ');
			pushText(text);
		}
	}

	// Parse via DOMParser then walk the parsed tree
	const parser = new DOMParser();
	const doc = parser.parseFromString(`<body>${clonedEl.innerHTML}</body>`, 'text/html');
	walk(doc.body);
	return segments;
}

// ─── Build char → rich segment index map ────────────────────────────────────

function buildCharIndexMap(richSegments) {
	const map = [];
	for (let i = 0; i < richSegments.length; i++) {
		for (const _ of richSegments[i].text) {
			map.push(i);
		}
	}
	return map;
}

function flattenRichText(richSegments) {
	return richSegments.map(s => s.text).join('');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildRichWords(lineText, globalOffset, charIndexMap, richSegments) {
	const words = [];
	for (const seg of _wordSeg.segment(lineText)) {
		if (!seg.segment.trim()) {
			words.push({ text: seg.segment, cssText: '', domStyle: '', className: '' });
			continue;
		}
		const firstGlobal = globalOffset + seg.index;
		const richSeg = (charIndexMap[firstGlobal] !== undefined)
			? richSegments[charIndexMap[firstGlobal]]
			: null;
		words.push({ text: seg.segment, cssText: richSeg?.cssText || '', domStyle: richSeg?.domStyle || '', className: richSeg?.className || '' });
	}
	return words;
}

function buildRichChars(lineText, globalOffset, charIndexMap, richSegments) {
	const chars = [];
	for (const seg of _charSeg.segment(lineText)) {
		if (seg.segment === ' ') {
			chars.push({ text: ' ', cssText: '', domStyle: '', className: '' });
			continue;
		}
		const firstGlobal = globalOffset + seg.index;
		const richSeg = (charIndexMap[firstGlobal] !== undefined)
			? richSegments[charIndexMap[firstGlobal]]
			: null;
		chars.push({ text: seg.segment, cssText: richSeg?.cssText || '', domStyle: richSeg?.domStyle || '', className: richSeg?.className || '' });
	}
	return chars;
}

// Build line fragments grouped by className
function buildRichLineFragments(lineText, globalOffset, charIndexMap, richSegments) {
	if (!lineText) return [];
	const fragments = [];
	let i = 0;
	while (i < lineText.length) {
		const globalIdx = globalOffset + i;
		const segIdx = charIndexMap[globalIdx];
		const seg = segIdx !== undefined ? richSegments[segIdx] : null;
		const className = seg?.className || '';

		// Find run of characters with the same className
		let j = i + 1;
		while (j < lineText.length) {
			const nextGlobalIdx = globalOffset + j;
			const nextSegIdx = charIndexMap[nextGlobalIdx];
			const nextSeg = nextSegIdx !== undefined ? richSegments[nextSegIdx] : null;
			if ((nextSeg?.className || '') !== className) break;
			j++;
		}

		fragments.push({ text: lineText.slice(i, j), className });
		i = j;
	}
	return fragments;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Split rich HTML text into animatable DOM elements.
 * Preserves <br> line breaks and inline styles (strong, em, span with class, etc.)
 *
 * @param {string|Element} selector - CSS selector or DOM element
 * @param {'lines'|'words'|'chars'} type - Split granularity
 * @param {boolean} [isMask=false] - Apply overflow:hidden mask per line
 * @returns {{ elements: HTMLElement[], lines: HTMLElement[], revert: () => void } | null}
 */
export function useSplitPretext({ selector, type = 'lines', isMask = false }) {
	const el = typeof selector === 'string'
		? document.querySelector(selector)
		: selector;
	if (!el) return null;

	const originalHTML = el.innerHTML || '';

	const cs = getComputedStyle(el);
	const rootFontSizePx = parseFloat(cs.fontSize);
	const lineHeight = parseFloat(cs.lineHeight) || rootFontSizePx * 1.5;
	const rect = el.getBoundingClientRect();
	const containerWidth = rect.width || 600;
	const textIndentPx = parseFloat(cs.textIndent) || 0;

	// Dynamically read 1rem in px from the html element — auto-adapts to any
	// CSS font-size formula and media query breakpoints. No hardcoded values.
	const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);

	// Extract primary font name from the font stack for canvas measurement.
	const fontStack = (cs.fontFamily || 'sans-serif').split(',');
	const _cssFontFamily = fontStack[0].trim().replace(/^["']|["']$/g, '') || 'sans-serif';

	// Convert computed px root font-size to rem for FS_MAP matching
	const rootFontSizeRem = (rootFontSizePx / remPx).toFixed(4) + 'rem';
	// Use the element's computed font-weight as the default (reflects fw-semi, fw-bold, etc.)
	const rootFW = String(cs.fontWeight);

	const richSegments = parseRichHTML(el, rootFontSizeRem, rootFW);
	const flatText = flattenRichText(richSegments);

	if (!flatText.trim()) return null;

	// rem → px converter for pretext canvas measurement
	const remToPx = (rem) => parseFloat(rem) * remPx;

	// Build font string for pretext canvas (needs px)
	const canvasFont = (fw, fs) => {
		const font = _cssFontFamily;
		if (typeof fs === 'string' && fs.endsWith('rem')) {
			return `${fw} ${remToPx(fs)}px ${font}`;
		}
		return `${fw} ${fs} ${font}`;
	};

	// Pretext: prepare each unique (text, font) pair
	const rootCanvasFont = canvasFont(cs.fontWeight, rootFontSizeRem);
	const cacheKey = `${flatText}__${rootCanvasFont}`;
	let prepared = _prepCache.get(cacheKey);
	if (!prepared) {
		prepared = prepareWithSegments(flatText, rootCanvasFont, { whiteSpace: 'pre-wrap' });
		_prepCache.set(cacheKey, prepared);
	}

	let lines = [];
	if (textIndentPx > 0) {
		let cursor = { segmentIndex: 0, graphemeIndex: 0 };
		while (cursor.segmentIndex < prepared.segments.length) {
			const isFirstLine = lines.length === 0;
			const width = isFirstLine ? Math.max(containerWidth - textIndentPx, 0) : containerWidth;

			const line = layoutNextLine(prepared, cursor, width);
			if (!line) break;

			lines.push(line);
			cursor = line.end;

			// Failsafe to prevent infinite loops if pretext makes no progress
			if (line.start.segmentIndex === line.end.segmentIndex && line.start.graphemeIndex === line.end.graphemeIndex) {
				break;
			}
		}
	} else {
		lines = layoutWithLines(prepared, containerWidth, lineHeight).lines;
	}
	const charIndexMap = buildCharIndexMap(richSegments);

	const allElements = [];
	const lineElements = [];
	let globalCharOffset = 0;

	el.innerHTML = '';

	for (const line of lines) {
		const isFirstLine = textIndentPx > 0 && lineElements.length === 0;
		const lineDiv = document.createElement('div');
		lineDiv.style.cssText = isMask
			? `display:block;text-align:inherit;position:relative;overflow:hidden;text-indent:${isFirstLine ? textIndentPx : 0}px;`
			: `display:block;text-align:inherit;position:relative;text-indent:${isFirstLine ? textIndentPx : 0}px;`;
		lineElements.push(lineDiv);

		if (type === 'lines') {
			const fragments = buildRichLineFragments(line.text, globalCharOffset, charIndexMap, richSegments);
			const hasClasses = fragments.some(f => f.className);

			if (!hasClasses) {
				// Simple case — single span, no class fragments
				const span = document.createElement('span');
				span.style.cssText = _spanStyleInline;
				span.className = 'split-line';
				span.textContent = line.text;
				lineDiv.appendChild(span);
				allElements.push(span);
			} else {
				// Mixed classes — wrap each fragment in a div (className on div)
				fragments.forEach(frag => {
					const wrapDiv = document.createElement('div');
					wrapDiv.style.cssText = 'display:inline;';
					if (frag.className) {
						frag.className.split(' ').forEach(c => wrapDiv.classList.add(c));
					}
					const span = document.createElement('span');
					span.style.cssText = _spanStyleInline;
					span.className = 'split-line';
					// Trailing space must be outside inline-block span (browser trims it)
					const trimmed = frag.text.replace(/\s+$/, '');
					const trailingSpace = frag.text.slice(trimmed.length);
					span.textContent = trimmed;
					wrapDiv.appendChild(span);
					lineDiv.appendChild(wrapDiv);
					if (trailingSpace) {
						lineDiv.appendChild(document.createTextNode(trailingSpace));
					}
					allElements.push(span);
				});
			}
			el.appendChild(lineDiv);

		} else if (type === 'words') {
			for (const { text, domStyle, className } of buildRichWords(line.text, globalCharOffset, charIndexMap, richSegments)) {
				if (!text.trim()) {
					lineDiv.appendChild(document.createTextNode(text));
					continue;
				}
				const span = document.createElement('span');
				span.style.cssText = domStyle
					? `${_spanStyleInline};${domStyle}`
					: _spanStyleInline;
				span.className = className ? `split-word ${className}` : 'split-word';
				span.textContent = text;
				lineDiv.appendChild(span);
				allElements.push(span);
			}
			el.appendChild(lineDiv);

		} else if (type === 'chars') {
			for (const { text, domStyle, className } of buildRichChars(line.text, globalCharOffset, charIndexMap, richSegments)) {
				if (text === ' ') {
					lineDiv.appendChild(document.createTextNode(' '));
					continue;
				}
				const span = document.createElement('span');
				span.style.cssText = domStyle
					? `${_spanStyleInline};${domStyle}`
					: _spanStyleInline;
				span.className = className ? `split-char ${className}` : 'split-char';
				span.textContent = text;
				lineDiv.appendChild(span);
				allElements.push(span);
			}
			el.appendChild(lineDiv);
		}

		globalCharOffset += line.text.length;
		// Skip newline characters in the flat text that pretext consumes
		// but doesn't include in line.text (from <br> or \n in source HTML)
		while (globalCharOffset < charIndexMap.length && flatText[globalCharOffset] === '\n') {
			globalCharOffset++;
		}
	}

	return {
		elements: allElements,
		lines: lineElements,
		revert: () => { el.innerHTML = originalHTML; }
	};
}
