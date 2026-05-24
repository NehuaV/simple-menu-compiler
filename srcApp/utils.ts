import {
	type LocalizedString,
	type Menu,
	type MenuEntry,
	type MenuImage,
	type MenuItem,
	type MenuPrice,
	type MenuSection,
	isLocalizedRecord,
	isStructuredImage,
	isStructuredPrice,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Internal "normalized" model used by the editor. Every localized field is a
// dictionary; every price has both an `amount/currency` shape and a free-form
// override; every image has both `src` and `placeholder`. Conversion to/from
// the canonical Menu JSON happens at the IO boundary (import + export).
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedSection {
	_uid: string;
	type: "section";
	id: string;
	name: Record<string, string>;
}

export interface NormalizedItem {
	_uid: string;
	type: "item";
	id: string;
	section: string;
	name: Record<string, string>;
	description: Record<string, string>;
	category: Record<string, string>;
	price: { amount: string; currency: string };
	priceFreeform: string;
	tags: string[];
	allergens: string[];
	calories: string;
	image: { src: string; placeholder: string };
}

export type NormalizedEntry = NormalizedSection | NormalizedItem;

export const isNormalizedSection = (
	e: NormalizedEntry,
): e is NormalizedSection => e.type === "section";

export const isNormalizedItem = (e: NormalizedEntry): e is NormalizedItem =>
	e.type === "item";

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

export function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

export function slugify(input: string): string {
	return (
		input
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "") || "section"
	);
}

/**
 * Resolve a localized string in a given locale, falling back to English then
 * to the first available value. Mirrors compiler.js's `localize`.
 */
export function localize(
	val: LocalizedString | undefined,
	locale: string,
): string {
	if (!val) return "";
	if (typeof val === "string") return val;
	return val[locale] ?? val.en ?? Object.values(val)[0] ?? "";
}

export function localizeDict(
	val: Record<string, string>,
	locale: string,
): string {
	return val[locale] ?? val.en ?? Object.values(val)[0] ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization (Menu JSON → editor model)
// ─────────────────────────────────────────────────────────────────────────────

function lift(
	val: LocalizedString | undefined,
	primaryLocale: string,
): Record<string, string> {
	if (val == null) return {};
	if (typeof val === "string") return val ? { [primaryLocale]: val } : {};
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(val)) {
		if (typeof v === "string" && v.length > 0) out[k] = v;
	}
	return out;
}

function liftPrice(p: MenuPrice | undefined): {
	price: NormalizedItem["price"];
	priceFreeform: string;
} {
	if (p == null) return { price: { amount: "", currency: "€" }, priceFreeform: "" };
	if (isStructuredPrice(p)) {
		return {
			price: { amount: String(p.amount), currency: p.currency },
			priceFreeform: "",
		};
	}
	return { price: { amount: "", currency: "€" }, priceFreeform: String(p) };
}

function liftImage(img: MenuImage | undefined): NormalizedItem["image"] {
	if (img == null) return { src: "", placeholder: "" };
	if (typeof img === "string") return { src: img, placeholder: "" };
	if (isStructuredImage(img))
		return { src: img.src, placeholder: img.placeholder ?? "" };
	return { src: "", placeholder: "" };
}

export function normalizeEntry(
	entry: MenuEntry,
	primaryLocale: string,
): NormalizedEntry {
	if (entry.type === "section") {
		return {
			_uid: uid(),
			type: "section",
			id: entry.id ?? slugify(localize(entry.name, primaryLocale)) ?? "section",
			name: lift(entry.name, primaryLocale),
		};
	}
	const { price, priceFreeform } = liftPrice(entry.price);
	return {
		_uid: uid(),
		type: "item",
		id: entry.id ?? "",
		section: entry.section ?? entry.sectionId ?? "",
		name: lift(entry.name, primaryLocale),
		description: lift(entry.description, primaryLocale),
		category: lift(entry.category, primaryLocale),
		price,
		priceFreeform,
		tags: [...(entry.tags ?? [])],
		allergens: [...(entry.allergens ?? [])],
		calories: entry.calories != null ? String(entry.calories) : "",
		image: liftImage(entry.image),
	};
}

export function detectLocales(menu: Menu): string[] {
	const set = new Set<string>(["en"]);
	for (const entry of menu) {
		for (const field of [
			entry.name,
			(entry as MenuItem).description,
			(entry as MenuItem).category,
		]) {
			if (isLocalizedRecord(field)) {
				for (const k of Object.keys(field)) set.add(k);
			}
		}
	}
	return [...set];
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization (editor model → Menu JSON)
// ─────────────────────────────────────────────────────────────────────────────

function emitLocalized(
	dict: Record<string, string>,
): LocalizedString | undefined {
	const entries = Object.entries(dict).filter(
		([, v]) => v != null && v.length > 0,
	);
	if (entries.length === 0) return undefined;
	if (entries.length === 1) {
		const only = entries[0];
		if (only && only[0] === "en") return only[1];
	}
	return Object.fromEntries(entries);
}

function emitPrice(item: NormalizedItem): MenuPrice | undefined {
	const freeform = item.priceFreeform.trim();
	if (freeform.length > 0) return freeform;
	const amount = Number(item.price.amount);
	if (!Number.isFinite(amount) || item.price.amount.trim() === "")
		return undefined;
	return { amount, currency: item.price.currency || "€" };
}

function emitImage(img: NormalizedItem["image"]): MenuImage | undefined {
	const src = img.src.trim();
	const placeholder = img.placeholder.trim();
	if (!src) return undefined;
	if (!placeholder) return src;
	return { src, placeholder };
}

export function serializeEntry(entry: NormalizedEntry): MenuEntry {
	if (entry.type === "section") {
		const name = emitLocalized(entry.name) ?? "";
		const section: MenuSection = {
			type: "section",
			id: entry.id || slugify(typeof name === "string" ? name : ""),
			name,
		};
		return section;
	}
	const out: MenuItem = {
		type: "item",
		name: emitLocalized(entry.name) ?? "",
	};
	if (entry.id) out.id = entry.id;
	if (entry.section) out.section = entry.section;
	const description = emitLocalized(entry.description);
	if (description !== undefined) out.description = description;
	const category = emitLocalized(entry.category);
	if (category !== undefined) out.category = category;
	const price = emitPrice(entry);
	if (price !== undefined) out.price = price;
	if (entry.tags.length > 0) out.tags = [...entry.tags];
	if (entry.allergens.length > 0) out.allergens = [...entry.allergens];
	const calories = Number(entry.calories);
	if (entry.calories.trim() !== "" && Number.isFinite(calories))
		out.calories = calories;
	const image = emitImage(entry.image);
	if (image !== undefined) out.image = image;
	return out;
}

export function serializeMenu(entries: NormalizedEntry[]): Menu {
	return entries.map(serializeEntry);
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructors for new entries (used by the toolbar)
// ─────────────────────────────────────────────────────────────────────────────

export function newSection(primaryLocale: string): NormalizedSection {
	const id = `section-${uid()}`;
	return {
		_uid: uid(),
		type: "section",
		id,
		name: { [primaryLocale]: "New section" },
	};
}

export function newItem(
	primaryLocale: string,
	sectionId = "",
): NormalizedItem {
	return {
		_uid: uid(),
		type: "item",
		id: "",
		section: sectionId,
		name: { [primaryLocale]: "New item" },
		description: {},
		category: {},
		price: { amount: "", currency: "€" },
		priceFreeform: "",
		tags: [],
		allergens: [],
		calories: "",
		image: { src: "", placeholder: "" },
	};
}
