import { useCallback, useEffect, useState } from "preact/hooks";
import { DEFAULT_SETTINGS, type TranslationSettings } from "./types";

const STORAGE_KEY = "menu-builder:translation-settings:v1";

function load(): TranslationSettings {
	if (typeof window === "undefined") return DEFAULT_SETTINGS;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_SETTINGS;
		const parsed = JSON.parse(raw) as Partial<TranslationSettings>;
		return { ...DEFAULT_SETTINGS, ...parsed };
	} catch {
		return DEFAULT_SETTINGS;
	}
}

function save(settings: TranslationSettings): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// quota / private mode — ignore
	}
}

export interface UseTranslationSettings {
	settings: TranslationSettings;
	update: (patch: Partial<TranslationSettings>) => void;
	replace: (next: TranslationSettings) => void;
}

export function useTranslationSettings(): UseTranslationSettings {
	const [settings, setSettings] = useState<TranslationSettings>(
		DEFAULT_SETTINGS,
	);

	useEffect(() => {
		setSettings(load());
	}, []);

	useEffect(() => {
		save(settings);
	}, [settings]);

	const update = useCallback((patch: Partial<TranslationSettings>) => {
		setSettings((prev) => ({ ...prev, ...patch }));
	}, []);

	const replace = useCallback((next: TranslationSettings) => {
		setSettings(next);
	}, []);

	return { settings, update, replace };
}
