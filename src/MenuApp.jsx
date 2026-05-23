import React, { useState, useEffect, useCallback, useRef } from "react";

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
	const image = item.image;
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

				{image && (
					<div className="aspect-[16/9] overflow-hidden rounded-t-2xl">
						<img
							src={image}
							alt={name}
							className="w-full h-full object-cover"
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
	const image = item.image;
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
				{image ? (
					<img
						src={image}
						alt={name}
						className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
						loading="lazy"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center font-serif text-5xl text-text-muted uppercase bg-gradient-to-br from-surface2 to-surface">
						<span>{name[0]}</span>
					</div>
				)}
				{category && (
					<span className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-md border border-white/[0.07] text-text-soft text-[11px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full">
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

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
				if (visible[0]) {
					setActiveId(visible[0].target.id);
				}
			},
			{
				rootMargin: "-30% 0px -60% 0px",
				threshold: [0, 0.25, 0.5, 0.75, 1],
			},
		);

		sections.forEach((sec) => {
			const el = sectionRefs.current[sec.id];
			if (el) observer.observe(el);
		});

		return () => observer.disconnect();
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
								onChange={(e) => setSearch(e.target.value)}
								aria-label="Search menu items"
								className="w-full sm:w-44 focus:sm:w-56 h-9 pl-8 pr-3.5 bg-surface2 border border-white/[0.07] rounded-full text-text text-xs sm:text-sm placeholder:text-text-muted outline-none focus:border-gold transition-all"
							/>
						</div>

						{allLocales.length > 1 && (
							<div
								className="flex gap-0.5 bg-surface2 border border-white/[0.07] rounded-full p-0.5 shrink-0"
								role="group"
								aria-label="Language"
							>
								{allLocales.map((l) => (
									<button
										type="button"
										key={l}
										className={
											locale === l
												? "px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wider transition-colors bg-gold text-bg"
												: "px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wider transition-colors text-text-muted hover:text-text"
										}
										onClick={() => setLocale(l)}
									>
										{l.toUpperCase()}
									</button>
								))}
							</div>
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
