import { useMenuContext } from "../context";

interface Props {
	label: string;
	value: Record<string, string>;
	onChange: (next: Record<string, string>) => void;
	multiline?: boolean;
	placeholder?: string;
}

/**
 * Edits the active-locale slot of a `Record<locale, string>` field. Shows a
 * small "translated in N/M locales" badge so authors can spot gaps without
 * switching back and forth.
 */
export function LocalizedField({
	label,
	value,
	onChange,
	multiline = false,
	placeholder,
}: Props) {
	const { state } = useMenuContext();
	const current = value[state.activeLocale] ?? "";
	const filled = state.locales.filter((l) => (value[l] ?? "").length > 0).length;

	const setValue = (next: string) => {
		const out = { ...value };
		if (next.length === 0) {
			delete out[state.activeLocale];
		} else {
			out[state.activeLocale] = next;
		}
		onChange(out);
	};

	const inputClass =
		"w-full px-3 py-2 rounded-md bg-surface2 border border-white/10 text-text text-sm focus:border-gold focus:outline-none resize-y";

	return (
		<label className="flex flex-col gap-1.5">
			<span className="flex items-center justify-between text-text-muted text-[11px] font-medium tracking-wider uppercase">
				<span>
					{label}{" "}
					<span className="text-text-muted/60 normal-case tracking-normal">
						({state.activeLocale})
					</span>
				</span>
				<span
					className={
						filled === state.locales.length
							? "text-gold/80 normal-case tracking-normal"
							: "text-text-muted/70 normal-case tracking-normal"
					}
				>
					{filled}/{state.locales.length} translated
				</span>
			</span>
			{multiline ? (
				<textarea
					value={current}
					onInput={(e) =>
						setValue((e.target as HTMLTextAreaElement).value)
					}
					placeholder={placeholder}
					rows={3}
					className={inputClass}
				/>
			) : (
				<input
					type="text"
					value={current}
					onInput={(e) => setValue((e.target as HTMLInputElement).value)}
					placeholder={placeholder}
					className={inputClass}
				/>
			)}
		</label>
	);
}
