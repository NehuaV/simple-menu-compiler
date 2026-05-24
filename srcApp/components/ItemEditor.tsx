import { useMenuContext } from "../context";
import {
	type NormalizedEntry,
	isNormalizedItem,
	isNormalizedSection,
	slugify,
	localizeDict,
} from "../utils";
import { ImageField } from "./ImageField";
import { LocalizedField } from "./LocalizedField";
import { PriceField } from "./PriceField";
import { TagInput } from "./TagInput";

const TAG_SUGGESTIONS = [
	"vegetarian",
	"vegan",
	"gluten-free",
	"dairy-free",
	"nut-free",
	"spicy",
	"new",
	"signature",
	"seafood",
	"meat",
	"organic",
	"local",
];

const ALLERGEN_SUGGESTIONS = [
	"gluten",
	"dairy",
	"eggs",
	"fish",
	"shellfish",
	"molluscs",
	"nuts",
	"peanuts",
	"soy",
	"sesame",
	"celery",
	"mustard",
	"sulphites",
];

export function ItemEditor() {
	const { selected } = useMenuContext();

	if (!selected) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 h-full text-center px-8 py-16">
				<div className="font-serif text-2xl text-text-muted">
					Select an entry to edit
				</div>
				<p className="text-text-muted text-sm max-w-xs">
					Pick a section or item on the left, or add a new one from the
					toolbar.
				</p>
			</div>
		);
	}

	return isNormalizedSection(selected) ? (
		<SectionEditor entry={selected} />
	) : isNormalizedItem(selected) ? (
		<ItemForm entry={selected} />
	) : null;
}

function SectionEditor({ entry }: { entry: NormalizedEntry }) {
	const { state, updateEntry } = useMenuContext();
	if (!isNormalizedSection(entry)) return null;

	const inputClass =
		"w-full px-3 py-2 rounded-md bg-surface2 border border-white/10 text-text text-sm focus:border-gold focus:outline-none";

	return (
		<div className="flex flex-col gap-5 p-6 max-w-2xl mx-auto w-full">
			<div className="flex items-center gap-2">
				<span className="px-2 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-gold text-[10px] tracking-wider uppercase">
					Section
				</span>
			</div>

			<LocalizedField
				label="Name"
				value={entry.name}
				onChange={(name) => {
					const patch: Partial<typeof entry> = { name };
					if (!entry.id || entry.id.startsWith("section-")) {
						patch.id = slugify(localizeDict(name, state.activeLocale)) || entry.id;
					}
					updateEntry(entry._uid, patch);
				}}
				placeholder="Starters"
			/>

			<label className="flex flex-col gap-1.5">
				<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
					Section id
				</span>
				<input
					type="text"
					value={entry.id}
					onInput={(e) =>
						updateEntry(entry._uid, {
							id: slugify((e.target as HTMLInputElement).value),
						})
					}
					placeholder="starters"
					className={inputClass}
				/>
				<span className="text-text-muted/70 text-xs">
					Used as the section anchor and referenced by items via{" "}
					<code className="text-gold/80">section</code>.
				</span>
			</label>
		</div>
	);
}

function ItemForm({ entry }: { entry: NormalizedEntry }) {
	const { sections, updateEntry } = useMenuContext();
	if (!isNormalizedItem(entry)) return null;

	const inputClass =
		"w-full px-3 py-2 rounded-md bg-surface2 border border-white/10 text-text text-sm focus:border-gold focus:outline-none";

	return (
		<div className="flex flex-col gap-5 p-6 max-w-3xl mx-auto w-full">
			<div className="flex items-center gap-2">
				<span className="px-2 py-0.5 rounded-full bg-surface3 border border-white/10 text-text-soft text-[10px] tracking-wider uppercase">
					Item
				</span>
				{entry.section && (
					<span className="text-text-muted text-xs">
						in <code className="text-gold/80">{entry.section}</code>
					</span>
				)}
			</div>

			<LocalizedField
				label="Name"
				value={entry.name}
				onChange={(name) => updateEntry(entry._uid, { name })}
				placeholder="Bruschetta"
			/>

			<LocalizedField
				label="Description"
				multiline
				value={entry.description}
				onChange={(description) => updateEntry(entry._uid, { description })}
				placeholder="Grilled bread rubbed with garlic, topped with fresh tomato…"
			/>

			<LocalizedField
				label="Category"
				value={entry.category}
				onChange={(category) => updateEntry(entry._uid, { category })}
				placeholder="Vegetarian"
			/>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<label className="flex flex-col gap-1.5">
					<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
						Section
					</span>
					<select
						value={entry.section}
						onInput={(e) =>
							updateEntry(entry._uid, {
								section: (e.target as HTMLSelectElement).value,
							})
						}
						className={inputClass}
					>
						<option value="">— Unassigned —</option>
						{sections.map((s) => (
							<option key={s.id} value={s.id}>
								{s.id}
							</option>
						))}
					</select>
				</label>

				<label className="flex flex-col gap-1.5">
					<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
						Item id (optional)
					</span>
					<input
						type="text"
						value={entry.id}
						onInput={(e) =>
							updateEntry(entry._uid, {
								id: slugify((e.target as HTMLInputElement).value),
							})
						}
						placeholder="auto-generated if blank"
						className={inputClass}
					/>
				</label>
			</div>

			<PriceField
				price={entry.price}
				freeform={entry.priceFreeform}
				onPriceChange={(price) => updateEntry(entry._uid, { price })}
				onFreeformChange={(priceFreeform) =>
					updateEntry(entry._uid, { priceFreeform })
				}
			/>

			<label className="flex flex-col gap-1.5">
				<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
					Calories
				</span>
				<input
					type="number"
					inputMode="numeric"
					value={entry.calories}
					onInput={(e) =>
						updateEntry(entry._uid, {
							calories: (e.target as HTMLInputElement).value,
						})
					}
					placeholder="280"
					className={inputClass}
				/>
			</label>

			<TagInput
				label="Tags"
				value={entry.tags}
				onChange={(tags) => updateEntry(entry._uid, { tags })}
				suggestions={TAG_SUGGESTIONS}
				placeholder="vegetarian, gluten-free…"
			/>

			<TagInput
				label="Allergens"
				value={entry.allergens}
				onChange={(allergens) => updateEntry(entry._uid, { allergens })}
				suggestions={ALLERGEN_SUGGESTIONS}
				placeholder="gluten, dairy…"
			/>

			<ImageField
				value={entry.image}
				onChange={(image) => updateEntry(entry._uid, { image })}
			/>
		</div>
	);
}
