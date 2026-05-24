import { createPortal } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { useMenuContext, useTranslationSettingsContext } from "../context";
import { pingEndpoint } from "../translation/client";
import { PRESETS, type TranslationSettings } from "../translation/types";

interface Props {
	onClose: () => void;
}

type PingState =
	| { kind: "idle" }
	| { kind: "running" }
	| { kind: "ok"; sample: string }
	| { kind: "error"; message: string };

export function SettingsDialog({ onClose }: Props) {
	const { settings, replace } = useTranslationSettingsContext();
	const { state } = useMenuContext();
	const [draft, setDraft] = useState<TranslationSettings>(settings);
	const [ping, setPing] = useState<PingState>({ kind: "idle" });

	useEffect(() => setDraft(settings), [settings]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [onClose]);

	const inputClass =
		"w-full px-3 py-2 rounded-md bg-surface2 border border-white/10 text-text text-sm focus:border-gold focus:outline-none";

	const applyPreset = (name: string) => {
		const preset = PRESETS.find((p) => p.name === name);
		if (!preset) return;
		setDraft({
			...draft,
			baseUrl: preset.settings.baseUrl,
			model: preset.settings.model,
		});
		setPing({ kind: "idle" });
	};

	const save = () => {
		replace(draft);
		onClose();
	};

	const test = async () => {
		setPing({ kind: "running" });
		const result = await pingEndpoint(draft);
		setPing(
			result.ok
				? { kind: "ok", sample: result.sample }
				: { kind: "error", message: result.error },
		);
	};

	const activePreset = PRESETS.find(
		(p) => p.settings.baseUrl === draft.baseUrl,
	);

	// Portal to document.body so the modal isn't trapped inside the toolbar's
	// containing block. The toolbar uses `backdrop-filter`, which creates a
	// new containing block for any `position: fixed` descendant and would
	// otherwise glue this dialog to the toolbar instead of the viewport.
	return createPortal(
		<div
			className="fixed inset-0 z-[9000] flex items-start sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label="Translation settings"
		>
			<div
				className="relative w-full max-w-lg my-auto bg-surface border border-white/10 rounded-2xl shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				<header className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
					<h2 className="font-serif text-xl text-text">Translation settings</h2>
					<button
						type="button"
						onClick={onClose}
						className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-text-muted hover:text-text grid place-items-center transition-colors"
						aria-label="Close"
					>
						✕
					</button>
				</header>

				<div className="flex flex-col gap-5 p-5">
					<section className="flex flex-col gap-2">
						<span className="text-text-muted text-[11px] tracking-wider uppercase">
							Quick presets
						</span>
						<div className="flex flex-wrap gap-2">
							{PRESETS.map((preset) => {
								const active = activePreset?.name === preset.name;
								return (
									<button
										key={preset.name}
										type="button"
										onClick={() => applyPreset(preset.name)}
										className={
											active
												? "px-3 py-1.5 rounded-md text-xs bg-gold text-bg font-medium"
												: "px-3 py-1.5 rounded-md text-xs bg-surface2 hover:bg-surface3 border border-white/10 text-text-soft hover:text-text transition-colors"
										}
									>
										{preset.name}
									</button>
								);
							})}
						</div>
						{activePreset && (
							<p className="text-text-muted text-xs leading-relaxed">
								{activePreset.settings.hint}
							</p>
						)}
					</section>

					<label className="flex flex-col gap-1.5">
						<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
							Base URL
						</span>
						<input
							type="url"
							value={draft.baseUrl}
							onInput={(e) =>
								setDraft({
									...draft,
									baseUrl: (e.target as HTMLInputElement).value,
								})
							}
							placeholder="http://127.0.0.1:1234/v1"
							className={inputClass}
						/>
					</label>

					<label className="flex flex-col gap-1.5">
						<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
							API key
						</span>
						<input
							type="password"
							value={draft.apiKey}
							onInput={(e) =>
								setDraft({
									...draft,
									apiKey: (e.target as HTMLInputElement).value,
								})
							}
							placeholder="Leave blank for local LM Studio"
							className={inputClass}
						/>
					</label>

					<label className="flex flex-col gap-1.5">
						<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
							Model
						</span>
						<input
							type="text"
							value={draft.model}
							onInput={(e) =>
								setDraft({
									...draft,
									model: (e.target as HTMLInputElement).value,
								})
							}
							placeholder="gpt-4o-mini, llama-3.3-70b-versatile, …"
							className={inputClass}
						/>
					</label>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<label className="flex flex-col gap-1.5">
							<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
								Temperature
							</span>
							<input
								type="number"
								min="0"
								max="2"
								step="0.05"
								value={draft.temperature}
								onInput={(e) =>
									setDraft({
										...draft,
										temperature: Number((e.target as HTMLInputElement).value),
									})
								}
								className={inputClass}
							/>
						</label>

						<label className="flex flex-col gap-1.5">
							<span className="text-text-muted text-[11px] font-medium tracking-wider uppercase">
								Source locale
							</span>
							<select
								value={draft.sourceLocale}
								onInput={(e) =>
									setDraft({
										...draft,
										sourceLocale: (e.target as HTMLSelectElement).value,
									})
								}
								className={inputClass}
							>
								<option value="auto">
									Auto (prefer English, then first available)
								</option>
								{state.locales.map((l) => (
									<option key={l} value={l}>
										{l}
									</option>
								))}
							</select>
						</label>
					</div>

					<div className="flex items-center gap-3 pt-2 border-t border-white/[0.07]">
						<button
							type="button"
							onClick={test}
							disabled={ping.kind === "running"}
							className="text-xs px-3 py-1.5 rounded-md bg-surface2 hover:bg-surface3 border border-white/10 text-text-soft hover:text-text transition-colors disabled:opacity-50"
						>
							{ping.kind === "running" ? "Testing…" : "Test connection"}
						</button>
						{ping.kind === "ok" && (
							<span className="text-xs text-gold-light">
								Connected — got: "{ping.sample}"
							</span>
						)}
					</div>
					{ping.kind === "error" && (
						<pre className="text-xs text-danger whitespace-pre-wrap bg-danger/10 border border-danger/30 rounded-md px-3 py-2 font-mono leading-relaxed">
							{ping.message}
						</pre>
					)}
				</div>

				<footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.07] bg-bg/40 sticky bottom-0 rounded-b-2xl">
					<button
						type="button"
						onClick={onClose}
						className="text-xs px-3 py-1.5 rounded-md bg-surface2 hover:bg-surface3 border border-white/10 text-text-soft hover:text-text transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={save}
						className="text-xs px-4 py-1.5 rounded-md bg-gold hover:bg-gold-light text-bg font-medium transition-colors"
					>
						Save
					</button>
				</footer>
			</div>
		</div>,
		document.body,
	);
}
