import { useCallback, useEffect, useMemo, useReducer } from "preact/hooks";
import type { Menu, MenuEntry } from "./types";
import {
	type NormalizedEntry,
	type NormalizedItem,
	type NormalizedSection,
	detectLocales,
	isNormalizedItem,
	isNormalizedSection,
	newItem,
	newSection,
	normalizeEntry,
	serializeMenu,
} from "./utils";

const STORAGE_KEY = "menu-builder:v1";

export interface MenuState {
	locales: string[];
	activeLocale: string;
	entries: NormalizedEntry[];
	selectedUid: string | null;
}

type Action =
	| { type: "set-active-locale"; locale: string }
	| { type: "add-locale"; locale: string }
	| { type: "remove-locale"; locale: string }
	| { type: "add-section" }
	| { type: "add-item"; sectionId?: string }
	| { type: "update-entry"; uid: string; patch: Partial<NormalizedEntry> }
	| { type: "delete-entry"; uid: string }
	| { type: "move-entry"; uid: string; direction: "up" | "down" }
	| { type: "select"; uid: string | null }
	| { type: "import"; menu: Menu }
	| { type: "reset" }
	| { type: "load-state"; state: MenuState };

function reducer(state: MenuState, action: Action): MenuState {
	switch (action.type) {
		case "set-active-locale":
			return { ...state, activeLocale: action.locale };

		case "add-locale": {
			if (state.locales.includes(action.locale)) return state;
			return { ...state, locales: [...state.locales, action.locale] };
		}

		case "remove-locale": {
			if (action.locale === "en") return state;
			const next = state.locales.filter((l) => l !== action.locale);
			const active =
				state.activeLocale === action.locale ? "en" : state.activeLocale;
			const entries = state.entries.map((e) => stripLocale(e, action.locale));
			return { ...state, locales: next, activeLocale: active, entries };
		}

		case "add-section": {
			const sec = newSection(state.activeLocale);
			return {
				...state,
				entries: [...state.entries, sec],
				selectedUid: sec._uid,
			};
		}

		case "add-item": {
			const sectionId =
				action.sectionId ??
				state.entries.find(isNormalizedSection)?.id ??
				"";
			const it = newItem(state.activeLocale, sectionId);
			return {
				...state,
				entries: [...state.entries, it],
				selectedUid: it._uid,
			};
		}

		case "update-entry": {
			const entries = state.entries.map((e) =>
				e._uid === action.uid ? ({ ...e, ...action.patch } as NormalizedEntry) : e,
			);
			return { ...state, entries };
		}

		case "delete-entry": {
			const entries = state.entries.filter((e) => e._uid !== action.uid);
			const selectedUid =
				state.selectedUid === action.uid ? null : state.selectedUid;
			return { ...state, entries, selectedUid };
		}

		case "move-entry": {
			const idx = state.entries.findIndex((e) => e._uid === action.uid);
			if (idx === -1) return state;
			const swapWith = action.direction === "up" ? idx - 1 : idx + 1;
			if (swapWith < 0 || swapWith >= state.entries.length) return state;
			const next = [...state.entries];
			const a = next[idx];
			const b = next[swapWith];
			if (!a || !b) return state;
			next[idx] = b;
			next[swapWith] = a;
			return { ...state, entries: next };
		}

		case "select":
			return { ...state, selectedUid: action.uid };

		case "import": {
			const locales = detectLocales(action.menu);
			const primary = locales[0] ?? "en";
			const entries = action.menu.map((e) => normalizeEntry(e, primary));
			return {
				locales,
				activeLocale: primary,
				entries,
				selectedUid: entries[0]?._uid ?? null,
			};
		}

		case "reset":
			return initialState();

		case "load-state":
			return action.state;
	}
}

function stripLocale(
	entry: NormalizedEntry,
	locale: string,
): NormalizedEntry {
	if (isNormalizedSection(entry)) {
		const name = { ...entry.name };
		delete name[locale];
		return { ...entry, name };
	}
	const name = { ...entry.name };
	delete name[locale];
	const description = { ...entry.description };
	delete description[locale];
	const category = { ...entry.category };
	delete category[locale];
	return { ...entry, name, description, category };
}

function initialState(): MenuState {
	return {
		locales: ["en"],
		activeLocale: "en",
		entries: [],
		selectedUid: null,
	};
}

function loadFromStorage(): MenuState | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as MenuState;
		if (!parsed || !Array.isArray(parsed.entries)) return null;
		return parsed;
	} catch {
		return null;
	}
}

function saveToStorage(state: MenuState): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// quota / private mode — ignore
	}
}

export interface MenuStore {
	state: MenuState;
	sections: NormalizedSection[];
	items: NormalizedItem[];
	selected: NormalizedEntry | null;
	setActiveLocale: (locale: string) => void;
	addLocale: (locale: string) => void;
	removeLocale: (locale: string) => void;
	addSection: () => void;
	addItem: (sectionId?: string) => void;
	updateEntry: (uid: string, patch: Partial<NormalizedEntry>) => void;
	deleteEntry: (uid: string) => void;
	moveEntry: (uid: string, direction: "up" | "down") => void;
	select: (uid: string | null) => void;
	importMenu: (menu: Menu) => void;
	reset: () => void;
	serialize: () => MenuEntry[];
}

export function useMenuStore(): MenuStore {
	const [state, dispatch] = useReducer(reducer, undefined, initialState);

	useEffect(() => {
		const persisted = loadFromStorage();
		if (persisted) dispatch({ type: "load-state", state: persisted });
	}, []);

	useEffect(() => {
		saveToStorage(state);
	}, [state]);

	const sections = useMemo(
		() => state.entries.filter(isNormalizedSection),
		[state.entries],
	);
	const items = useMemo(
		() => state.entries.filter(isNormalizedItem),
		[state.entries],
	);
	const selected = useMemo(
		() => state.entries.find((e) => e._uid === state.selectedUid) ?? null,
		[state.entries, state.selectedUid],
	);

	const setActiveLocale = useCallback(
		(locale: string) => dispatch({ type: "set-active-locale", locale }),
		[],
	);
	const addLocale = useCallback(
		(locale: string) => dispatch({ type: "add-locale", locale }),
		[],
	);
	const removeLocale = useCallback(
		(locale: string) => dispatch({ type: "remove-locale", locale }),
		[],
	);
	const addSection = useCallback(() => dispatch({ type: "add-section" }), []);
	const addItem = useCallback(
		(sectionId?: string) => dispatch({ type: "add-item", sectionId }),
		[],
	);
	const updateEntry = useCallback(
		(uid: string, patch: Partial<NormalizedEntry>) =>
			dispatch({ type: "update-entry", uid, patch }),
		[],
	);
	const deleteEntry = useCallback(
		(uid: string) => dispatch({ type: "delete-entry", uid }),
		[],
	);
	const moveEntry = useCallback(
		(uid: string, direction: "up" | "down") =>
			dispatch({ type: "move-entry", uid, direction }),
		[],
	);
	const select = useCallback(
		(uid: string | null) => dispatch({ type: "select", uid }),
		[],
	);
	const importMenu = useCallback(
		(menu: Menu) => dispatch({ type: "import", menu }),
		[],
	);
	const reset = useCallback(() => dispatch({ type: "reset" }), []);
	const serialize = useCallback(
		() => serializeMenu(state.entries),
		[state.entries],
	);

	return {
		state,
		sections,
		items,
		selected,
		setActiveLocale,
		addLocale,
		removeLocale,
		addSection,
		addItem,
		updateEntry,
		deleteEntry,
		moveEntry,
		select,
		importMenu,
		reset,
		serialize,
	};
}
