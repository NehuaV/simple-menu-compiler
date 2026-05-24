import { useState } from "preact/hooks";
import { useMenuContext } from "../context";

export function JsonPreview() {
	const { serialize } = useMenuContext();
	const [copied, setCopied] = useState(false);

	const json = JSON.stringify(serialize(), null, 2);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(json);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// noop
		}
	};

	const download = () => {
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "menu.json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	return (
		<aside className="flex flex-col h-full bg-bg border-l border-white/[0.05]">
			<header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
				<div className="flex items-center gap-2">
					<span className="font-serif text-base text-text">JSON output</span>
					<span className="text-text-muted text-xs">
						({(new Blob([json]).size / 1024).toFixed(1)} KB)
					</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={copy}
						className="text-xs px-2.5 py-1 rounded-md bg-surface2 hover:bg-surface3 border border-white/10 text-text-soft hover:text-text transition-colors"
					>
						{copied ? "Copied" : "Copy"}
					</button>
					<button
						type="button"
						onClick={download}
						className="text-xs px-2.5 py-1 rounded-md bg-gold hover:bg-gold-light text-bg font-medium transition-colors"
					>
						Download
					</button>
				</div>
			</header>
			<pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-soft whitespace-pre">
				{json}
			</pre>
		</aside>
	);
}
