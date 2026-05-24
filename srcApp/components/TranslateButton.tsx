import { useMemo, useRef, useState } from "preact/hooks";
import { useMenuContext, useTranslationSettingsContext } from "../context";
import {
	findMissingTranslations,
	translateAll,
} from "../translation/translator";
import type { TranslationProgress } from "../translation/types";

type Status =
	| { kind: "idle" }
	| { kind: "running"; progress: TranslationProgress }
	| { kind: "done"; filled: number; errors: number }
	| { kind: "error"; message: string };

interface Props {
	onOpenSettings: () => void;
}

export function TranslateButton({ onOpenSettings }: Props) {
	const { state, applyTranslations } = useMenuContext();
	const { settings } = useTranslationSettingsContext();
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const abortRef = useRef<AbortController | null>(null);

	const missing = useMemo(
		() =>
			findMissingTranslations(
				state.entries,
				state.locales,
				settings.sourceLocale,
			),
		[state.entries, state.locales, settings.sourceLocale],
	);

	const hasWork = missing.length > 0;

	const run = async () => {
		if (!hasWork) return;
		if (!settings.baseUrl.trim()) {
			onOpenSettings();
			return;
		}

		abortRef.current?.abort();
		const ctrl = new AbortController();
		abortRef.current = ctrl;

		setStatus({
			kind: "running",
			progress: { completed: 0, total: missing.length },
		});

		try {
			const outcome = await translateAll({
				settings,
				missing,
				signal: ctrl.signal,
				onProgress: (progress) =>
					setStatus({ kind: "running", progress }),
			});
			applyTranslations(outcome.results);
			setStatus({
				kind: "done",
				filled: outcome.results.length,
				errors: outcome.errors.length,
			});
		} catch (err) {
			setStatus({
				kind: "error",
				message: err instanceof Error ? err.message : String(err),
			});
		} finally {
			abortRef.current = null;
		}
	};

	const cancel = () => {
		abortRef.current?.abort();
		setStatus({ kind: "idle" });
	};

	const label = (() => {
		if (status.kind === "running") {
			const { completed, total, currentLocale } = status.progress;
			const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
			return currentLocale
				? `Translating → ${currentLocale} · ${pct}%`
				: `Translating · ${pct}%`;
		}
		if (status.kind === "done") {
			return status.errors > 0
				? `Filled ${status.filled} (${status.errors} errors)`
				: `Filled ${status.filled} translations`;
		}
		if (status.kind === "error") return "Translation failed";
		return hasWork
			? `Translate ${missing.length} missing`
			: "Everything translated";
	})();

	const baseBtn =
		"text-xs px-3 py-1.5 rounded-md border transition-colors flex items-center gap-2";

	if (status.kind === "running") {
		return (
			<div className="flex items-center gap-2">
				<button
					type="button"
					disabled
					className={`${baseBtn} bg-gold/20 border-gold/40 text-gold cursor-wait`}
					aria-live="polite"
				>
					<span className="inline-block h-2 w-2 rounded-full bg-gold animate-pulse" />
					{label}
				</button>
				<button
					type="button"
					onClick={cancel}
					className={`${baseBtn} bg-surface2 hover:bg-surface3 border-white/10 text-text-muted hover:text-danger`}
				>
					Cancel
				</button>
			</div>
		);
	}

	const tone =
		status.kind === "error"
			? "bg-danger/15 border-danger/40 text-danger hover:bg-danger/20"
			: status.kind === "done"
				? "bg-gold/15 border-gold/40 text-gold-light hover:bg-gold/20"
				: hasWork
					? "bg-gold hover:bg-gold-light border-gold text-bg font-medium"
					: "bg-surface2 border-white/10 text-text-muted cursor-not-allowed";

	return (
		<div className="flex items-center gap-2">
			<button
				type="button"
				onClick={run}
				disabled={!hasWork && status.kind === "idle"}
				title={
					status.kind === "error"
						? status.message
						: hasWork
							? `${missing.length} missing across ${state.locales.length} locales`
							: "No missing translations"
				}
				className={`${baseBtn} ${tone}`}
			>
				<TranslateIcon />
				{label}
			</button>
			<button
				type="button"
				onClick={onOpenSettings}
				className={`${baseBtn} bg-surface2 hover:bg-surface3 border-white/10 text-text-muted hover:text-text`}
				aria-label="Translation settings"
				title="Translation settings"
			>
				<span className="inline-block">⚙</span>
			</button>
		</div>
	);
}

function TranslateIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-3.5 w-3.5"
			aria-hidden="true"
		>
			<path d="m5 8 6 6" />
			<path d="m4 14 6-6 2-3" />
			<path d="M2 5h12" />
			<path d="M7 2h1" />
			<path d="m22 22-5-10-5 10" />
			<path d="M14 18h6" />
		</svg>
	);
}
