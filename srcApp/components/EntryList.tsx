import { useMenuContext } from "../context";
import {
	type NormalizedEntry,
	isNormalizedItem,
	isNormalizedSection,
	localizeDict,
} from "../utils";

/**
 * Left sidebar: lists all entries grouped by their section, plus an
 * "Unassigned" bucket for items without a section pointer.
 */
export function EntryList() {
	const {
		state,
		sections,
		items,
		select,
		deleteEntry,
		moveEntry,
		addItem,
	} = useMenuContext();

	const itemsBySection = new Map<string, typeof items>();
	for (const item of items) {
		const key = item.section || "__unassigned__";
		const list = itemsBySection.get(key) ?? [];
		list.push(item);
		itemsBySection.set(key, list);
	}
	const unassigned = itemsBySection.get("__unassigned__") ?? [];

	if (sections.length === 0 && items.length === 0) {
		return (
			<div className="px-4 py-12 text-center text-text-muted text-sm">
				No entries yet. Use the toolbar to add a section or an item.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{sections.map((sec) => (
				<SectionGroup
					key={sec._uid}
					section={sec}
					items={itemsBySection.get(sec.id) ?? []}
					activeLocale={state.activeLocale}
					selectedUid={state.selectedUid}
					onSelect={select}
					onDelete={deleteEntry}
					onMove={moveEntry}
					onAddItem={() => addItem(sec.id)}
				/>
			))}
			{unassigned.length > 0 && (
				<div className="flex flex-col gap-1">
					<div className="px-2 py-1 text-text-muted text-[10px] tracking-wider uppercase">
						Unassigned
					</div>
					{unassigned.map((it) => (
						<EntryRow
							key={it._uid}
							entry={it}
							activeLocale={state.activeLocale}
							selected={state.selectedUid === it._uid}
							onSelect={select}
							onDelete={deleteEntry}
							onMove={moveEntry}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function SectionGroup({
	section,
	items,
	activeLocale,
	selectedUid,
	onSelect,
	onDelete,
	onMove,
	onAddItem,
}: {
	section: NormalizedEntry;
	items: NormalizedEntry[];
	activeLocale: string;
	selectedUid: string | null;
	onSelect: (uid: string | null) => void;
	onDelete: (uid: string) => void;
	onMove: (uid: string, dir: "up" | "down") => void;
	onAddItem: () => void;
}) {
	if (!isNormalizedSection(section)) return null;
	const label = localizeDict(section.name, activeLocale) || "(untitled)";

	return (
		<div className="flex flex-col">
			<div
				className={
					selectedUid === section._uid
						? "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border bg-gold/10 border-gold/30"
						: "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border border-transparent hover:bg-surface2"
				}
				onClick={() => onSelect(section._uid)}
				onKeyDown={(e) => e.key === "Enter" && onSelect(section._uid)}
				role="button"
				tabIndex={0}
			>
				<span className="font-serif text-base text-text flex-1 truncate">
					{label}
				</span>
				<span className="text-text-muted text-[10px] uppercase tracking-wider">
					{section.id}
				</span>
				<RowActions
					uid={section._uid}
					onDelete={onDelete}
					onMove={onMove}
				/>
			</div>
			<div className="flex flex-col gap-1 pl-3 mt-1">
				{items.map((it) => (
					<EntryRow
						key={it._uid}
						entry={it}
						activeLocale={activeLocale}
						selected={selectedUid === it._uid}
						onSelect={onSelect}
						onDelete={onDelete}
						onMove={onMove}
					/>
				))}
				<button
					type="button"
					onClick={onAddItem}
					className="self-start text-text-muted hover:text-gold text-xs px-2 py-1 mt-1 rounded-md border border-dashed border-white/10 hover:border-gold/40 transition-colors"
				>
					+ Item in this section
				</button>
			</div>
		</div>
	);
}

function EntryRow({
	entry,
	activeLocale,
	selected,
	onSelect,
	onDelete,
	onMove,
}: {
	entry: NormalizedEntry;
	activeLocale: string;
	selected: boolean;
	onSelect: (uid: string | null) => void;
	onDelete: (uid: string) => void;
	onMove: (uid: string, dir: "up" | "down") => void;
}) {
	if (!isNormalizedItem(entry)) return null;
	const label = localizeDict(entry.name, activeLocale) || "(untitled)";

	return (
		<div
			className={
				selected
					? "group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer border bg-surface2 border-gold/40"
					: "group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer border border-transparent hover:bg-surface2/60"
			}
			onClick={() => onSelect(entry._uid)}
			onKeyDown={(e) => e.key === "Enter" && onSelect(entry._uid)}
			role="button"
			tabIndex={0}
		>
			{entry.image.src ? (
				<img
					src={entry.image.placeholder || entry.image.src}
					alt=""
					aria-hidden="true"
					className="w-8 h-8 rounded object-cover shrink-0"
				/>
			) : (
				<span className="w-8 h-8 rounded bg-surface3 shrink-0 grid place-items-center text-text-muted text-xs">
					·
				</span>
			)}
			<span className="text-sm text-text flex-1 truncate">{label}</span>
			<RowActions uid={entry._uid} onDelete={onDelete} onMove={onMove} />
		</div>
	);
}

function RowActions({
	uid,
	onDelete,
	onMove,
}: {
	uid: string;
	onDelete: (uid: string) => void;
	onMove: (uid: string, dir: "up" | "down") => void;
}) {
	const stop = (
		e: { stopPropagation: () => void; preventDefault: () => void },
		fn: () => void,
	) => {
		e.stopPropagation();
		e.preventDefault();
		fn();
	};
	return (
		<span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
			<button
				type="button"
				onClick={(e) => stop(e, () => onMove(uid, "up"))}
				className="text-text-muted hover:text-text px-1"
				aria-label="Move up"
				title="Move up"
			>
				↑
			</button>
			<button
				type="button"
				onClick={(e) => stop(e, () => onMove(uid, "down"))}
				className="text-text-muted hover:text-text px-1"
				aria-label="Move down"
				title="Move down"
			>
				↓
			</button>
			<button
				type="button"
				onClick={(e) => stop(e, () => onDelete(uid))}
				className="text-text-muted hover:text-danger px-1"
				aria-label="Delete"
				title="Delete"
			>
				×
			</button>
		</span>
	);
}
