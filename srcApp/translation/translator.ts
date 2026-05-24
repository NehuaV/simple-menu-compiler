import {
	type NormalizedEntry,
	isNormalizedItem,
	isNormalizedSection,
} from "../utils";
import { chatCompletion, extractJson } from "./client";
import type {
	MissingTranslation,
	TranslatableField,
	TranslationProgress,
	TranslationResult,
	TranslationSettings,
} from "./types";

const TRANSLATABLE_ITEM_FIELDS: TranslatableField[] = [
	"name",
	"description",
	"category",
];

// ─────────────────────────────────────────────────────────────────────────────
// 1) Detection: walk the entries, return every missing locale slot.
// ─────────────────────────────────────────────────────────────────────────────

function pickSource(
	dict: Record<string, string>,
	preferred: string,
): { locale: string; text: string } | null {
	const trimmed = (s: string) => (s ?? "").trim();

	if (preferred !== "auto") {
		const val = trimmed(dict[preferred] ?? "");
		if (val) return { locale: preferred, text: val };
	}
	const en = trimmed(dict.en ?? "");
	if (en) return { locale: "en", text: en };
	for (const [locale, text] of Object.entries(dict)) {
		const t = trimmed(text);
		if (t) return { locale, text: t };
	}
	return null;
}

function collectMissingFromField(
	uid: string,
	field: TranslatableField,
	dict: Record<string, string>,
	locales: string[],
	sourcePref: string,
	out: MissingTranslation[],
): void {
	const src = pickSource(dict, sourcePref);
	if (!src) return;
	for (const target of locales) {
		if (target === src.locale) continue;
		const existing = (dict[target] ?? "").trim();
		if (existing) continue;
		out.push({
			uid,
			field,
			sourceLocale: src.locale,
			sourceText: src.text,
			targetLocale: target,
		});
	}
}

export function findMissingTranslations(
	entries: NormalizedEntry[],
	locales: string[],
	sourcePref: string,
): MissingTranslation[] {
	const out: MissingTranslation[] = [];
	for (const entry of entries) {
		if (isNormalizedSection(entry)) {
			collectMissingFromField(
				entry._uid,
				"name",
				entry.name,
				locales,
				sourcePref,
				out,
			);
		} else if (isNormalizedItem(entry)) {
			for (const field of TRANSLATABLE_ITEM_FIELDS) {
				collectMissingFromField(
					entry._uid,
					field,
					entry[field],
					locales,
					sourcePref,
					out,
				);
			}
		}
	}
	return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Batching: group missing translations by (sourceLocale → targetLocale).
//    One API call per group, with all texts in a single JSON request.
// ─────────────────────────────────────────────────────────────────────────────

interface Batch {
	sourceLocale: string;
	targetLocale: string;
	items: MissingTranslation[];
}

function groupIntoBatches(items: MissingTranslation[]): Batch[] {
	const map = new Map<string, Batch>();
	for (const item of items) {
		const key = `${item.sourceLocale}→${item.targetLocale}`;
		const batch = map.get(key);
		if (batch) {
			batch.items.push(item);
		} else {
			map.set(key, {
				sourceLocale: item.sourceLocale,
				targetLocale: item.targetLocale,
				items: [item],
			});
		}
	}
	return [...map.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Prompting + API call. The system prompt anchors the model on menu
//    translation; the user payload is a JSON list of texts keyed by index.
// ─────────────────────────────────────────────────────────────────────────────

function languageName(locale: string, displayInLocale = "en"): string {
	try {
		const dn = new Intl.DisplayNames([displayInLocale], { type: "language" });
		return dn.of(locale) ?? locale;
	} catch {
		return locale;
	}
}

function buildPrompt(
	batch: Batch,
): { system: string; user: string } {
	const sourceName = languageName(batch.sourceLocale);
	const targetName = languageName(batch.targetLocale);
	const targetNative = languageName(batch.targetLocale, batch.targetLocale);

	const system = [
		`You are a professional translator for restaurant menus.`,
		`Translate from ${sourceName} (${batch.sourceLocale}) to ${targetName} / ${targetNative} (${batch.targetLocale}).`,
		`Rules:`,
		`- Preserve culinary terminology that is conventionally kept in its original language (e.g. "risotto", "sushi", "crème brûlée").`,
		`- Keep tone consistent with the source; do not embellish or shorten.`,
		`- Do not translate proper names of dishes that are widely recognised internationally unless the target language has an established equivalent.`,
		`- Return ONLY valid JSON of the shape {"translations":[{"id":string,"text":string},...]} — no commentary.`,
	].join("\n");

	const user = JSON.stringify({
		instruction: `Translate each "text" into ${targetName}. Return the same "id" for each.`,
		items: batch.items.map((item, i) => ({
			id: String(i),
			text: item.sourceText,
		})),
	});

	return { system, user };
}

interface BatchResponse {
	translations: { id: string; text: string }[];
}

// JSON Schema for the expected response. Both OpenAI (`json_schema` strict mode
// since gpt-4o) and LM Studio support this; the client transparently falls
// back to plain-text mode if a server doesn't.
const TRANSLATION_SCHEMA: Record<string, unknown> = {
	type: "object",
	properties: {
		translations: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string" },
					text: { type: "string" },
				},
				required: ["id", "text"],
				additionalProperties: false,
			},
		},
	},
	required: ["translations"],
	additionalProperties: false,
};

async function translateBatch(
	settings: TranslationSettings,
	batch: Batch,
	signal?: AbortSignal,
): Promise<TranslationResult[]> {
	const { system, user } = buildPrompt(batch);
	const reply = await chatCompletion(
		settings,
		{
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: user },
			],
			jsonSchema: { name: "translations", schema: TRANSLATION_SCHEMA },
		},
		signal,
	);

	const parsed = extractJson<Partial<BatchResponse>>(reply);
	const arr = Array.isArray(parsed.translations) ? parsed.translations : [];

	const byIndex = new Map<number, string>();
	for (const entry of arr) {
		const idx = Number(entry?.id);
		if (Number.isInteger(idx) && typeof entry?.text === "string") {
			byIndex.set(idx, entry.text);
		}
	}

	const results: TranslationResult[] = [];
	batch.items.forEach((item, i) => {
		const text = byIndex.get(i);
		if (text && text.trim().length > 0) {
			results.push({
				uid: item.uid,
				field: item.field,
				targetLocale: item.targetLocale,
				text: text.trim(),
			});
		}
	});
	return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Orchestrator. Drives the batches, fires onProgress between groups, and
//    collects per-batch errors without aborting the whole run.
// ─────────────────────────────────────────────────────────────────────────────

export interface TranslateAllOptions {
	settings: TranslationSettings;
	missing: MissingTranslation[];
	signal?: AbortSignal;
	onProgress?: (p: TranslationProgress) => void;
}

export interface TranslateAllOutcome {
	results: TranslationResult[];
	errors: { targetLocale: string; message: string }[];
}

export async function translateAll(
	opts: TranslateAllOptions,
): Promise<TranslateAllOutcome> {
	const { settings, missing, signal, onProgress } = opts;
	const batches = groupIntoBatches(missing);
	const total = missing.length;
	const results: TranslationResult[] = [];
	const errors: { targetLocale: string; message: string }[] = [];
	let completed = 0;

	onProgress?.({ completed, total });

	for (const batch of batches) {
		if (signal?.aborted) break;
		onProgress?.({ completed, total, currentLocale: batch.targetLocale });
		try {
			const batchResults = await translateBatch(settings, batch, signal);
			results.push(...batchResults);
		} catch (err) {
			errors.push({
				targetLocale: batch.targetLocale,
				message: err instanceof Error ? err.message : String(err),
			});
		}
		completed += batch.items.length;
		onProgress?.({ completed, total, currentLocale: batch.targetLocale });
	}

	onProgress?.({ completed, total });
	return { results, errors };
}
