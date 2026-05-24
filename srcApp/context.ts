import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { MenuStore } from "./state";
import type { UseTranslationSettings } from "./translation/settings";

export const MenuStoreContext = createContext<MenuStore | null>(null);

export function useMenuContext(): MenuStore {
	const ctx = useContext(MenuStoreContext);
	if (!ctx) {
		throw new Error(
			"useMenuContext must be used within a MenuStoreContext.Provider",
		);
	}
	return ctx;
}

export const TranslationSettingsContext =
	createContext<UseTranslationSettings | null>(null);

export function useTranslationSettingsContext(): UseTranslationSettings {
	const ctx = useContext(TranslationSettingsContext);
	if (!ctx) {
		throw new Error(
			"useTranslationSettingsContext must be used within a TranslationSettingsContext.Provider",
		);
	}
	return ctx;
}
