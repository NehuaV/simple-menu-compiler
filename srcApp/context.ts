import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { MenuStore } from "./state";

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
