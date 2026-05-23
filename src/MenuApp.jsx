import { useState, useEffect, useCallback, useRef } from "preact/hooks";

// ── Locale → ISO 3166-1 alpha-2 country code for flag-icons ──────────────────
// Maps language codes (BCP 47-ish) to the country whose flag visually represents
// that language. Extend as needed; falls back to the locale itself.
export const LOCALE_TO_COUNTRY = {
	en: "gb",
	it: "it",
	fr: "fr",
	es: "es",
	de: "de",
	pt: "pt",
	"pt-br": "br",
	"en-us": "us",
	"en-gb": "gb",
	nl: "nl",
	pl: "pl",
	ru: "ru",
	uk: "ua",
	cs: "cz",
	sk: "sk",
	hu: "hu",
	ro: "ro",
	bg: "bg",
	el: "gr",
	tr: "tr",
	sv: "se",
	da: "dk",
	no: "no",
	nb: "no",
	fi: "fi",
	is: "is",
	ja: "jp",
	zh: "cn",
	"zh-hk": "hk",
	"zh-tw": "tw",
	ko: "kr",
	vi: "vn",
	th: "th",
	id: "id",
	ms: "my",
	hi: "in",
	bn: "bd",
	ta: "lk",
	he: "il",
	ar: "sa",
	fa: "ir",
	ur: "pk",
	sw: "ke",
	af: "za",
};

export function localeToCountry(locale) {
	const k = String(locale ?? "").toLowerCase();
	return LOCALE_TO_COUNTRY[k] ?? k.split("-")[0] ?? k;
}

export function languageDisplayName(code, inLocale = code) {
	try {
		const dn = new Intl.DisplayNames([inLocale], { type: "language" });
		const name = dn.of(code);
		if (name && name !== code)
			return name.charAt(0).toUpperCase() + name.slice(1);
	} catch {}
	return code.toUpperCase();
}

// ── Image cache (Cache API, 5-minute TTL) ────────────────────────────────────
// Uses the browser's native Cache API instead of IndexedDB/localforage. Stores
// the original fetch Response (with a custom timestamp header) so we can hand
// the bytes back as a blob URL on repeat visits without re-hitting the network.
const IMAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const IMAGE_CACHE_NAME = "menu-compiler-images-v1";
const TIMESTAMP_HEADER = "x-cached-at";

function hasCacheApi() {
	return typeof window !== "undefined" && "caches" in window;
}

/**
 * Open (or create) the image cache.
 * @returns {Promise<Cache | null>}
 */
async function getImageCache() {
	if (!hasCacheApi()) return null;
	try {
		return await caches.open(IMAGE_CACHE_NAME);
	} catch {
		return null;
	}
}

/**
 * Return a blob URL for a fresh cached copy of `url`, or null if missing/stale.
 * Stale entries are evicted as a side effect.
 * @param {string} url
 * @returns {Promise<string | null>}
 */
async function getCachedBlobUrl(url) {
	const cache = await getImageCache();
	if (!cache || !url) return null;
	try {
		const res = await cache.match(url);
		if (!res) return null;
		const ts = Number(res.headers.get(TIMESTAMP_HEADER));
		if (!ts || Date.now() - ts > IMAGE_CACHE_TTL_MS) {
			cache.delete(url).catch(() => {});
			return null;
		}
		const blob = await res.blob();
		return URL.createObjectURL(blob);
	} catch {
		return null;
	}
}

/**
 * Fetch `url` and store it in the image cache, stamped with the current time.
 * @param {string} url
 * @returns {Promise<void>}
 */
async function cacheImage(url) {
	const cache = await getImageCache();
	if (!cache || !url) return;
	try {
		const res = await fetch(url, { mode: "cors", credentials: "omit" });
		if (!res.ok) return;
		const blob = await res.blob();
		const stamped = new Response(blob, {
			headers: {
				"content-type": blob.type || "application/octet-stream",
				[TIMESTAMP_HEADER]: String(Date.now()),
			},
		});
		await cache.put(url, stamped);
	} catch {}
}

export function localize(val, locale) {
	if (!val || typeof val === "string") return val ?? "";
	return val[locale] ?? val["en"] ?? Object.values(val)[0] ?? "";
}

export function detectLocales(menuData) {
	const set = new Set(["en"]);
	for (const item of menuData) {
		const fields = [item.name, item.description, item.category];
		for (const f of fields) {
			if (f && typeof f === "object") {
				for (const k of Object.keys(f)) {
					set.add(k);
				}
			}
		}
	}
	return [...set];
}

function slugify(str) {
	return (
		String(str)
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "") || "section"
	);
}

function formatPrice(price) {
	if (price == null) return null;
	if (typeof price === "object")
		return `${price.currency ?? ""}${price.amount}`;
	return price;
}

function normalizeImage(image) {
	if (!image) return null;
	if (typeof image === "string") return { src: image, placeholder: null };
	return { src: image.src ?? null, placeholder: image.placeholder ?? null };
}

// ── ProgressiveImage ─────────────────────────────────────────────────────────
// Renders a low-res blurred placeholder underneath, and fades in the high-res
// image once it has finished loading. Both `<img>` tags are absolutely
// positioned and fill their (relatively positioned) parent container.
//
// Caches images via the Cache API with a 5-minute TTL:
//  - First visit:  render uses the original URL; we fetch a copy in the
//                  background and store it in the Cache API.
//  - Repeat visit: we swap the `src` to a blob URL produced from the cached
//                  response body, so the browser never hits the network.
function ProgressiveImage({ src, placeholder, alt, eager = false }) {
	const [resolvedSrc, setResolvedSrc] = useState(src);
	const [fromCache, setFromCache] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const imgRef = useRef(null);

	useEffect(() => {
		if (typeof window === "undefined" || !src) return;

		let cancelled = false;
		let createdBlobUrl = null;

		(async () => {
			const cached = await getCachedBlobUrl(src);
			if (cancelled) {
				if (cached) URL.revokeObjectURL(cached);
				return;
			}
			if (cached) {
				createdBlobUrl = cached;
				setFromCache(true);
				setResolvedSrc(cached);
				return;
			}
			cacheImage(src);
		})();

		return () => {
			cancelled = true;
			if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
		};
	}, [src]);

	useEffect(() => {
		if (fromCache) {
			setLoaded(true);
			return;
		}
		setLoaded(false);
		const img = imgRef.current;
		if (img?.complete && img.naturalWidth > 0) setLoaded(true);
	}, [resolvedSrc, fromCache]);

	if (!src) return null;

	// Cached path: render the high-res blob URL instantly with no transition
	// (and skip the blurred placeholder entirely — there's nothing to mask).
	// Uncached path: show the placeholder underneath and fade the high-res in
	// on load.
	const highResClass = fromCache
		? "absolute inset-0 w-full h-full object-cover opacity-100"
		: placeholder
			? loaded
				? "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 opacity-100"
				: "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 opacity-0"
			: "absolute inset-0 w-full h-full object-cover";

	return (
		<>
			{placeholder && !fromCache && (
				<img
					src={placeholder}
					alt=""
					aria-hidden="true"
					className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
				/>
			)}
			<img
				ref={imgRef}
				src={resolvedSrc}
				alt={alt}
				loading={eager ? "eager" : "lazy"}
				decoding="async"
				onLoad={() => setLoaded(true)}
				className={highResClass}
			/>
		</>
	);
}

// ── LanguageDropdown ─────────────────────────────────────────────────────────
function LanguageDropdown({ locales, current, onChange }) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e) => {
			if (containerRef.current && !containerRef.current.contains(e.target)) {
				setOpen(false);
			}
		};
		const onKey = (e) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const currentCountry = localeToCountry(current);
	const currentName = languageDisplayName(current, current);

	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-label="Change language"
				className="inline-flex items-center gap-2 h-9 px-3 rounded-full bg-surface2 border border-white/[0.07] text-text text-xs sm:text-sm font-medium hover:border-gold/40 focus:border-gold focus:outline-none transition-colors"
			>
				<span
					className={`fi fi-${currentCountry} shrink-0 rounded-sm shadow-sm shadow-black/40`}
					aria-hidden="true"
				/>
				<span className="hidden sm:inline tracking-wide">{currentName}</span>
				<span className="sm:hidden tracking-wider">
					{current.toUpperCase()}
				</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
					className={
						open
							? "h-4 w-4 text-text-muted transition-transform rotate-180"
							: "h-4 w-4 text-text-muted transition-transform"
					}
				>
					<path
						fillRule="evenodd"
						d="M10.293 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L10 12.586l3.293-3.293a1 1 0 011.414 1.414l-4 4z"
						clipRule="evenodd"
					/>
				</svg>
			</button>

			{open && (
				<ul
					role="listbox"
					aria-label="Available languages"
					className="absolute right-0 mt-2 min-w-[12rem] bg-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fadeIn"
				>
					{locales.map((loc) => {
						const country = localeToCountry(loc);
						const native = languageDisplayName(loc, loc);
						const active = loc === current;
						return (
							<li key={loc}>
								<button
									type="button"
									role="option"
									aria-selected={active}
									onClick={() => {
										onChange(loc);
										setOpen(false);
									}}
									className={
										active
											? "w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-text bg-gold/10 hover:bg-gold/15 transition-colors"
											: "w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-text-soft hover:bg-white/[0.04] hover:text-text transition-colors"
									}
								>
									<span
										className={`fi fi-${country} shrink-0 rounded-sm shadow-sm shadow-black/40`}
										aria-hidden="true"
									/>
									<span className="flex-1 text-left tracking-wide">
										{native}
									</span>
									{active && (
										<span className="text-gold text-xs" aria-hidden="true">
											●
										</span>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

// ── Modal ────────────────────────────────────────────────────────────────────
function Modal({ item, locale, onClose }) {
	useEffect(() => {
		const handler = (e) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", handler);
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", handler);
			document.body.style.overflow = "";
		};
	}, [onClose]);

	const name = localize(item.name, locale);
	const description = localize(item.description, locale);
	const category = localize(item.category, locale);
	const tags = item.tags ?? [];
	const allergens = item.allergens ?? [];
	const price = item.price;
	const calories = item.calories;
	const image = normalizeImage(item.image);
	const displayPrice = formatPrice(price);

	return (
		<div
			className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fadeIn"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label={name}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
		>
			<div
				className="relative w-full sm:max-w-xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto bg-surface border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slideUp"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.key === "Escape" && onClose()}
				role="dialog"
				aria-modal="true"
				aria-label={name}
			>
				<button
					type="button"
					className="absolute top-3 right-3 z-10 h-9 w-9 sm:h-8 sm:w-8 rounded-full bg-white/10 hover:bg-white/20 text-text-muted hover:text-text flex items-center justify-center text-sm transition-colors"
					onClick={onClose}
					aria-label="Close"
				>
					✕
				</button>

				{image?.src && (
					<div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl bg-surface2">
						<ProgressiveImage
							src={image.src}
							placeholder={image.placeholder}
							alt={name}
							eager
						/>
					</div>
				)}

				<div className="p-5 sm:p-7 flex flex-col gap-3.5">
					{category && (
						<span className="text-gold text-[11px] font-medium tracking-[0.1em] uppercase">
							{category}
						</span>
					)}
					<h2 className="font-serif text-2xl sm:text-3xl font-normal leading-tight text-text">
						{name}
					</h2>

					{description && (
						<p className="text-text-soft text-sm sm:text-base leading-relaxed">
							{description}
						</p>
					)}

					<div className="flex gap-6 py-3.5 border-y border-white/[0.07]">
						{displayPrice && (
							<div className="flex flex-col gap-0.5">
								<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
									Price
								</span>
								<span className="font-serif text-xl sm:text-2xl font-semibold text-gold-light">
									{displayPrice}
								</span>
							</div>
						)}
						{calories != null && (
							<div className="flex flex-col gap-0.5">
								<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
									Calories
								</span>
								<span className="text-text-soft text-sm">{calories} kcal</span>
							</div>
						)}
					</div>

					{tags.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{tags.map((t) => (
								<span
									key={t}
									className="bg-gold/10 border border-gold/20 text-gold text-[10px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full"
								>
									{t}
								</span>
							))}
						</div>
					)}

					{allergens.length > 0 && (
						<div className="text-text-muted text-xs sm:text-sm bg-white/[0.03] border border-white/[0.07] rounded-md px-3.5 py-2.5">
							<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
								Contains:{" "}
							</span>
							{allergens.join(", ")}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ── MenuItem card ────────────────────────────────────────────────────────────
function MenuItem({ item, locale, onOpen }) {
	const name = localize(item.name, locale);
	const category = localize(item.category, locale);
	const price = item.price;
	const image = normalizeImage(item.image);
	const tags = item.tags ?? [];
	const displayPrice = formatPrice(price);

	return (
		<article
			className="group flex flex-col bg-surface border border-white/[0.07] rounded-xl overflow-hidden cursor-pointer outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/35 hover:shadow-card focus-visible:-translate-y-0.5 focus-visible:border-gold/35 focus-visible:shadow-card"
			onClick={() => onOpen(item)}
			tabIndex={0}
			onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(item)}
			role="button"
			aria-label={`View details for ${name}`}
		>
			<div className="relative aspect-[4/3] bg-surface2 overflow-hidden">
				{image?.src ? (
					<div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]">
						<ProgressiveImage
							src={image.src}
							placeholder={image.placeholder}
							alt={name}
						/>
					</div>
				) : (
					<div className="w-full h-full flex items-center justify-center font-serif text-5xl text-text-muted uppercase bg-gradient-to-br from-surface2 to-surface">
						<span>{name[0]}</span>
					</div>
				)}
				{category && (
					<span className="absolute top-2.5 left-2.5 z-10 bg-black/75 backdrop-blur-md border border-white/[0.07] text-text-soft text-[11px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full">
						{category}
					</span>
				)}
			</div>

			<div className="flex flex-col gap-2.5 p-4 sm:p-[18px] flex-1">
				<h3 className="font-serif text-lg sm:text-xl font-medium leading-tight text-text">
					{name}
				</h3>

				{tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{tags.slice(0, 3).map((t) => (
							<span
								key={t}
								className="bg-gold/10 border border-gold/20 text-gold text-[10px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full"
							>
								{t}
							</span>
						))}
					</div>
				)}

				<div className="flex items-center justify-between mt-auto pt-2.5 border-t border-white/[0.07]">
					{displayPrice && (
						<span className="font-serif text-lg font-semibold text-gold">
							{displayPrice}
						</span>
					)}
					<span className="text-text-muted text-xs font-medium tracking-wide transition-colors group-hover:text-gold-light">
						View ↗
					</span>
				</div>
			</div>
		</article>
	);
}

// ── Section ──────────────────────────────────────────────────────────────────
function Section({ id, title, items, locale, onOpen, registerRef }) {
	return (
		<section
			id={id}
			ref={registerRef}
			className="mb-12 sm:mb-16 scroll-mt-32 sm:scroll-mt-28"
		>
			{title && (
				<h2 className="font-serif text-2xl sm:text-3xl font-normal italic text-text mb-5 sm:mb-7 flex items-center gap-4 sm:gap-5">
					<span>{title}</span>
					<span className="flex-1 h-px bg-white/[0.07]" />
				</h2>
			)}
			<div className="grid gap-3 sm:gap-5 grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{items.map((item, i) => (
					<MenuItem
						key={item.id ?? i}
						item={item}
						locale={locale}
						onOpen={onOpen}
					/>
				))}
			</div>
		</section>
	);
}

// ── Section nav bar ──────────────────────────────────────────────────────────
function SectionNav({ sections, activeId, onJump }) {
	const navRef = useRef(null);

	useEffect(() => {
		if (!activeId || !navRef.current) return;
		const btn = navRef.current.querySelector(`[data-section-id="${activeId}"]`);
		if (btn) {
			btn.scrollIntoView({
				behavior: "smooth",
				inline: "center",
				block: "nearest",
			});
		}
	}, [activeId]);

	if (sections.length < 2) return null;

	return (
		<nav
			aria-label="Menu sections"
			className="border-t border-white/[0.05] bg-bg/85 backdrop-blur-md"
		>
			<div
				ref={navRef}
				className="max-w-7xl mx-auto flex gap-1.5 sm:gap-2 overflow-x-auto px-3 sm:px-6 py-2.5 sm:py-3 no-scrollbar"
			>
				{sections.map((sec) => {
					const active = sec.id === activeId;
					return (
						<button
							key={sec.id}
							type="button"
							data-section-id={sec.id}
							onClick={() => onJump(sec.id)}
							className={
								active
									? "shrink-0 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium tracking-wide whitespace-nowrap transition-colors bg-gold text-bg"
									: "shrink-0 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium tracking-wide whitespace-nowrap transition-colors bg-surface2 text-text-soft hover:text-text hover:bg-white/[0.08] border border-white/[0.06]"
							}
						>
							{sec.title}
						</button>
					);
				})}
			</div>
		</nav>
	);
}

// ── MenuApp root ─────────────────────────────────────────────────────────────
export default function MenuApp({
	menuData = [],
	initialLocale = "en",
	restaurantName = "Our Menu",
}) {
	const allLocales = detectLocales(menuData);
	const [locale, setLocale] = useState(initialLocale);
	const [selected, setSelected] = useState(null);
	const [search, setSearch] = useState("");
	const [activeId, setActiveId] = useState(null);
	const sectionRefs = useRef({});

	const openModal = useCallback((item) => setSelected(item), []);
	const closeModal = useCallback(() => setSelected(null), []);

	const items = menuData.filter((d) => d.type === "item" || !d.type);

	const filtered = search.trim()
		? items.filter((item) => {
				const n = localize(item.name, locale).toLowerCase();
				const c = localize(item.category, locale).toLowerCase();
				const q = search.toLowerCase();
				return n.includes(q) || c.includes(q);
			})
		: items;

	const sections = [];
	const sectionEntries = menuData.filter((d) => d.type === "section");

	if (sectionEntries.length > 0) {
		sectionEntries.forEach((sec) => {
			const secName = localize(sec.name, locale);
			const secItems = filtered.filter(
				(it) => it.section === sec.id || it.sectionId === sec.id,
			);
			if (secItems.length) {
				sections.push({
					id: sec.id || slugify(secName),
					title: secName,
					items: secItems,
				});
			}
		});
		const orphans = filtered.filter(
			(it) =>
				!sectionEntries.some(
					(s) => it.section === s.id || it.sectionId === s.id,
				),
		);
		if (orphans.length) {
			sections.push({ id: "other", title: "Other", items: orphans });
		}
	} else {
		const catMap = new Map();
		filtered.forEach((it) => {
			const cat = localize(it.category, locale) || "Menu";
			if (!catMap.has(cat)) catMap.set(cat, []);
			catMap.get(cat).push(it);
		});

		for (const [cat, its] of catMap) {
			sections.push({
				id: slugify(cat),
				title: catMap.size === 1 && cat === "Menu" ? null : cat,
				items: its,
			});
		}
	}

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (sections.length < 2) return;

		// Active-section detection: do NOT update while the page is actively
		// scrolling. Only after the scroll has been idle for SCROLL_IDLE_MS do we
		// recompute which section is currently in focus. This avoids the active
		// pill flickering through every section the viewport sweeps past during a
		// fast or programmatic (smooth) scroll.
		const SCROLL_IDLE_MS = 120;
		// Reference line: a horizontal line ~30% from the top of the viewport.
		// The active section is the one whose top has most recently crossed
		// above this line.
		const referenceY = () => Math.round(window.innerHeight * 0.3);

		let idleTimeout = null;

		const computeActive = () => {
			const refY = referenceY();
			let bestId = sections[0]?.id ?? null;
			let bestTop = -Infinity;
			for (const sec of sections) {
				const el = sectionRefs.current[sec.id];
				if (!el) continue;
				const top = el.getBoundingClientRect().top;
				if (top <= refY && top > bestTop) {
					bestTop = top;
					bestId = sec.id;
				}
			}
			if (bestId) setActiveId(bestId);
		};

		const onScroll = () => {
			if (idleTimeout) clearTimeout(idleTimeout);
			idleTimeout = setTimeout(computeActive, SCROLL_IDLE_MS);
		};

		// Initial compute (for the section visible on load).
		computeActive();

		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (idleTimeout) clearTimeout(idleTimeout);
		};
	}, [sections.map((s) => s.id).join("|")]);

	const jumpTo = useCallback((id) => {
		const el = sectionRefs.current[id];
		if (el && typeof window !== "undefined") {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
		}
		setActiveId(id);
	}, []);

	const navSections = sections.filter((s) => s.title);

	return (
		<>
			<header className="sticky top-0 z-50 bg-bg/85 backdrop-blur-md border-b border-white/[0.07]">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6">
					<div className="flex items-center gap-2.5 min-w-0">
						<div className="w-2 h-2 rounded-full bg-gold shrink-0" />
						<h1 className="font-serif text-lg sm:text-xl font-medium tracking-wide text-text truncate">
							{restaurantName}
						</h1>
					</div>

					<div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
						<div className="relative flex-1 sm:flex-initial">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-base pointer-events-none leading-none">
								⌕
							</span>
							<input
								type="search"
								placeholder="Search…"
								value={search}
								onInput={(e) => setSearch(e.target.value)}
								aria-label="Search menu items"
								className="w-full sm:w-44 focus:sm:w-56 h-9 pl-8 pr-3.5 bg-surface2 border border-white/[0.07] rounded-full text-text text-xs sm:text-sm placeholder:text-text-muted outline-none focus:border-gold transition-all"
							/>
						</div>

						{allLocales.length > 1 && (
							<LanguageDropdown
								locales={allLocales}
								current={locale}
								onChange={setLocale}
							/>
						)}
					</div>
				</div>

				<SectionNav
					sections={navSections}
					activeId={activeId}
					onJump={jumpTo}
				/>
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-20">
				{sections.length === 0 ? (
					<p className="text-text-muted text-center py-20 italic">
						No items found.
					</p>
				) : (
					sections.map((sec) => (
						<Section
							key={sec.id}
							id={sec.id}
							title={sec.title}
							items={sec.items}
							locale={locale}
							onOpen={openModal}
							registerRef={(el) => {
								if (el) sectionRefs.current[sec.id] = el;
							}}
						/>
					))
				)}
			</main>

			{selected && (
				<Modal item={selected} locale={locale} onClose={closeModal} />
			)}
		</>
	);
}
