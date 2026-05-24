import { useState } from "preact/hooks";
import { useMenuContext } from "../context";

const COMMON_LOCALES = [
	"en",
	"it",
	"fr",
	"es",
	"de",
	"pt",
	"nl",
	"ja",
	"zh",
	"ko",
	"ar",
	"ru",
	"sv",
	"pl",
	"tr",
	"el",
];

export function LocalePicker() {
	const { state, setActiveLocale, addLocale, removeLocale } = useMenuContext();
	const [adding, setAdding] = useState(false);
	const [draft, setDraft] = useState("");

	const submit = () => {
		const code = draft.trim().toLowerCase();
		if (code) addLocale(code);
		setDraft("");
		setAdding(false);
	};

	return (
		<div className="flex items-center gap-2 flex-wrap">
			<span className="text-text-muted text-xs font-medium tracking-wider uppercase">
				Locales
			</span>
			{state.locales.map((loc) => {
				const active = loc === state.activeLocale;
				return (
					<div key={loc} className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => setActiveLocale(loc)}
							className={
								active
									? "px-2.5 py-1 rounded-full text-xs font-medium bg-gold text-bg"
									: "px-2.5 py-1 rounded-full text-xs font-medium bg-surface2 text-text-soft hover:text-text hover:bg-surface3 border border-white/[0.06]"
							}
						>
							{loc.toUpperCase()}
						</button>
						{loc !== "en" && (
							<button
								type="button"
								onClick={() => removeLocale(loc)}
								className="text-text-muted hover:text-danger text-xs px-1"
								title={`Remove ${loc}`}
								aria-label={`Remove locale ${loc}`}
							>
								×
							</button>
						)}
					</div>
				);
			})}
			{adding ? (
				<div className="flex items-center gap-1">
					<input
						type="text"
						value={draft}
						onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submit();
							if (e.key === "Escape") {
								setAdding(false);
								setDraft("");
							}
						}}
						placeholder="es, fr-CA…"
						autoFocus
						list="locale-suggestions"
						className="w-24 px-2 py-1 rounded-md bg-surface2 border border-white/10 text-text text-xs focus:border-gold focus:outline-none"
					/>
					<datalist id="locale-suggestions">
						{COMMON_LOCALES.filter((l) => !state.locales.includes(l)).map(
							(l) => (
								<option key={l} value={l} />
							),
						)}
					</datalist>
					<button
						type="button"
						onClick={submit}
						className="text-gold text-xs px-1"
					>
						Add
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface2 text-text-muted hover:text-gold hover:bg-surface3 border border-dashed border-white/10"
				>
					+ Locale
				</button>
			)}
		</div>
	);
}
