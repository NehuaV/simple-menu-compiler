// ─────────────────────────────────────────────────────────────────────────────
// Translation contracts. The client targets any OpenAI-compatible
// /v1/chat/completions endpoint:
//   - LM Studio  → http://127.0.0.1:1234/v1      (no key required)
//   - OpenAI     → https://api.openai.com/v1     (Bearer key)
//   - OpenRouter → https://openrouter.ai/api/v1  (Bearer key)
//   - Groq       → https://api.groq.com/openai/v1
//   - Anything else that speaks the OpenAI Chat Completions protocol.
// ─────────────────────────────────────────────────────────────────────────────

export interface TranslationSettings {
	/** Fully-qualified base URL of the /v1 endpoint, with no trailing slash. */
	baseUrl: string;
	/** Bearer token; leave blank for local LM Studio. */
	apiKey: string;
	/** Model identifier passed verbatim in the request body. */
	model: string;
	/** Sampling temperature; lower values produce more faithful translations. */
	temperature: number;
	/**
	 * Locale code to pull source text from when filling missing slots.
	 * `"auto"` prefers English, falling back to the entry's first available
	 * non-empty value.
	 */
	sourceLocale: string;
}

export type TranslatableField = "name" | "description" | "category";

/** A single text the translator should fill in. */
export interface MissingTranslation {
	uid: string;
	field: TranslatableField;
	sourceLocale: string;
	sourceText: string;
	targetLocale: string;
}

/** Result of a single translation. */
export interface TranslationResult {
	uid: string;
	field: TranslatableField;
	targetLocale: string;
	text: string;
}

export interface TranslationProgress {
	completed: number;
	total: number;
	currentLocale?: string;
	error?: string;
}

export const DEFAULT_SETTINGS: TranslationSettings = {
	baseUrl: "http://127.0.0.1:1234/v1",
	apiKey: "",
	model: "local-model",
	temperature: 0.2,
	sourceLocale: "auto",
};

export interface SettingsPreset {
	name: string;
	settings: Pick<TranslationSettings, "baseUrl" | "model"> & {
		hint: string;
	};
}

export const PRESETS: SettingsPreset[] = [
	{
		name: "LM Studio (local)",
		settings: {
			baseUrl: "http://127.0.0.1:1234/v1",
			model: "local-model",
			hint: "Defaults work with any model loaded in LM Studio.",
		},
	},
	{
		name: "OpenAI",
		settings: {
			baseUrl: "https://api.openai.com/v1",
			model: "gpt-4o-mini",
			hint: "Requires an OPENAI_API_KEY. Note: browsers block direct calls due to CORS — use only behind a proxy in production.",
		},
	},
	{
		name: "OpenRouter",
		settings: {
			baseUrl: "https://openrouter.ai/api/v1",
			model: "openai/gpt-4o-mini",
			hint: "Aggregator that exposes many models behind one OpenAI-compatible API.",
		},
	},
	{
		name: "Groq",
		settings: {
			baseUrl: "https://api.groq.com/openai/v1",
			model: "llama-3.3-70b-versatile",
			hint: "Fast hosted inference with OpenAI-compatible endpoints.",
		},
	},
];
