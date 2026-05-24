// ─────────────────────────────────────────────────────────────────────────────
// Menu schema — the contract consumed by `compiler.js`.
//
// These types mirror the README spec exactly: every entry in the menu array
// is either a Section or an Item, discriminated by the `type` field.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A field that may be a plain string or a record keyed by locale code.
 * Example: "Starters" | { en: "Starters", it: "Antipasti", fr: "Entrées" }.
 */
export type LocalizedString = string | Readonly<Record<string, string>>;

/**
 * Price field. Either a structured `{ amount, currency }` pair, a free-form
 * string ("Market price"), or a bare number.
 */
export type MenuPrice =
	| string
	| number
	| { amount: number; currency: string };

/**
 * Image field. Either a single URL string or a `{ src, placeholder }` pair
 * that drives progressive image loading.
 */
export type MenuImage =
	| string
	| { src: string; placeholder?: string };

/**
 * A menu section — a group heading that items reference by `id`.
 */
export interface MenuSection {
	type: "section";
	id: string;
	name: LocalizedString;
}

/**
 * A menu item. `section` is the canonical pointer to a section `id`;
 * `sectionId` is accepted as an alias for backwards compatibility.
 */
export interface MenuItem {
	type: "item";
	id?: string;
	section?: string;
	sectionId?: string;
	name: LocalizedString;
	description?: LocalizedString;
	category?: LocalizedString;
	price?: MenuPrice;
	tags?: string[];
	allergens?: string[];
	calories?: number;
	image?: MenuImage;
}

export type MenuEntry = MenuSection | MenuItem;

/**
 * The full menu — the JSON array produced by this app and consumed by
 * `compiler.js` to render the static HTML menu.
 */
export type Menu = MenuEntry[];

// ─────────────────────────────────────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────────────────────────────────────

export function isSection(entry: MenuEntry): entry is MenuSection {
	return entry.type === "section";
}

export function isItem(entry: MenuEntry): entry is MenuItem {
	return entry.type === "item";
}

export function isLocalizedRecord(
	v: LocalizedString | undefined,
): v is Readonly<Record<string, string>> {
	return !!v && typeof v === "object";
}

export function isStructuredPrice(
	v: MenuPrice | undefined,
): v is { amount: number; currency: string } {
	return (
		!!v &&
		typeof v === "object" &&
		typeof (v as { amount: unknown }).amount === "number"
	);
}

export function isStructuredImage(
	v: MenuImage | undefined,
): v is { src: string; placeholder?: string } {
	return !!v && typeof v === "object" && typeof v.src === "string";
}
