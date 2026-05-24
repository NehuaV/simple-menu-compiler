import { useState } from "preact/hooks";

interface Props {
	label: string;
	value: string[];
	onChange: (next: string[]) => void;
	suggestions?: string[];
	placeholder?: string;
}

export function TagInput({
	label,
	value,
	onChange,
	suggestions,
	placeholder,
}: Props) {
	const [draft, setDraft] = useState("");

	const add = (raw: string) => {
		const cleaned = raw.trim().toLowerCase();
		if (!cleaned) return;
		if (value.includes(cleaned)) {
			setDraft("");
			return;
		}
		onChange([...value, cleaned]);
		setDraft("");
	};

	const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

	const datalistId = `taglist-${label.replace(/\s+/g, "-").toLowerCase()}`;

	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
				{label}
			</span>
			<div className="flex flex-wrap gap-1.5 px-2 py-2 rounded-md bg-surface2 border border-white/10 focus-within:border-gold transition-colors min-h-[2.5rem]">
				{value.map((t) => (
					<span
						key={t}
						className="inline-flex items-center gap-1 bg-gold/15 border border-gold/30 text-gold text-xs px-2 py-0.5 rounded-full"
					>
						<span>{t}</span>
						<button
							type="button"
							onClick={() => remove(t)}
							className="text-gold/70 hover:text-gold"
							aria-label={`Remove ${t}`}
						>
							×
						</button>
					</span>
				))}
				<input
					type="text"
					value={draft}
					list={suggestions ? datalistId : undefined}
					onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === ",") {
							e.preventDefault();
							add(draft);
						} else if (e.key === "Backspace" && !draft && value.length > 0) {
							const last = value[value.length - 1];
							if (last) remove(last);
						}
					}}
					onBlur={() => add(draft)}
					placeholder={placeholder ?? "Type and press Enter…"}
					className="flex-1 min-w-[8rem] bg-transparent text-text text-sm focus:outline-none"
				/>
				{suggestions && (
					<datalist id={datalistId}>
						{suggestions.map((s) => (
							<option key={s} value={s} />
						))}
					</datalist>
				)}
			</div>
		</div>
	);
}
