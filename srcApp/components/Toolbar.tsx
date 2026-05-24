import { useRef, useState } from "preact/hooks";
import sampleMenu from "../../sample-menu.json";
import { useMenuContext } from "../context";
import type { Menu } from "../types";
import { LocalePicker } from "./LocalePicker";
import { SettingsDialog } from "./SettingsDialog";
import { TranslateButton } from "./TranslateButton";

export function Toolbar() {
	const { addSection, addItem, importMenu, reset } = useMenuContext();
	const fileRef = useRef<HTMLInputElement>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);

	const onFile = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const parsed = JSON.parse(text) as Menu;
			if (!Array.isArray(parsed)) throw new Error("Menu must be an array");
			importMenu(parsed);
		} catch (err) {
			alert(
				`Could not import menu: ${err instanceof Error ? err.message : String(err)}`,
			);
		} finally {
			target.value = "";
		}
	};

	const loadSample = () => importMenu(sampleMenu as Menu);

	const confirmReset = () => {
		if (
			window.confirm(
				"Clear the entire menu? Your work will be lost. (It's still saved in localStorage until you refresh.)",
			)
		) {
			reset();
		}
	};

	return (
		<header className="flex flex-col gap-3 px-4 sm:px-6 py-3 bg-bg/95 backdrop-blur-md border-b border-white/[0.07] sticky top-0 z-30">
			<div className="flex items-center gap-3 flex-wrap">
				<div className="flex items-baseline gap-3">
					<h1 className="font-serif text-xl text-text">Menu builder</h1>
					<span className="text-text-muted text-xs hidden sm:inline">
						compose JSON for{" "}
						<code className="text-gold/80">compiler.js</code>
					</span>
				</div>
				<div className="flex-1" />
				<div className="flex items-center gap-2 flex-wrap">
					<button
						type="button"
						onClick={addSection}
						className="text-xs px-3 py-1.5 rounded-md bg-surface2 hover:bg-surface3 border border-white/10 text-text-soft hover:text-text transition-colors"
					>
						+ Section
					</button>
					<button
						type="button"
						onClick={() => addItem()}
						className="text-xs px-3 py-1.5 rounded-md bg-surface2 hover:bg-surface3 border border-white/10 text-text-soft hover:text-text transition-colors"
					>
						+ Item
					</button>
					<span className="w-px h-5 bg-white/10 mx-1" />
					<button
						type="button"
						onClick={() => fileRef.current?.click()}
						className="text-xs px-3 py-1.5 rounded-md bg-surface2 hover:bg-surface3 border border-white/10 text-text-soft hover:text-text transition-colors"
					>
						Import JSON
					</button>
					<input
						ref={fileRef}
						type="file"
						accept="application/json,.json"
						onChange={onFile}
						className="hidden"
					/>
					<button
						type="button"
						onClick={loadSample}
						className="text-xs px-3 py-1.5 rounded-md bg-surface2 hover:bg-surface3 border border-white/10 text-text-soft hover:text-text transition-colors"
					>
						Load sample
					</button>
					<button
						type="button"
						onClick={confirmReset}
						className="text-xs px-3 py-1.5 rounded-md bg-surface2 hover:bg-danger/20 border border-white/10 hover:border-danger/40 text-text-soft hover:text-danger transition-colors"
					>
						Clear
					</button>
				</div>
			</div>
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<LocalePicker />
				<TranslateButton onOpenSettings={() => setSettingsOpen(true)} />
			</div>
			{settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
		</header>
	);
}
