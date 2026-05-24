import {
	MenuStoreContext,
	TranslationSettingsContext,
} from "./context";
import { useMenuStore } from "./state";
import { useTranslationSettings } from "./translation/settings";
import { EntryList } from "./components/EntryList";
import { ItemEditor } from "./components/ItemEditor";
import { JsonPreview } from "./components/JsonPreview";
import { Toolbar } from "./components/Toolbar";

export function App() {
	const store = useMenuStore();
	const translationSettings = useTranslationSettings();

	return (
		<MenuStoreContext.Provider value={store}>
			<TranslationSettingsContext.Provider value={translationSettings}>
				<div className="flex flex-col h-screen w-screen bg-bg text-text font-sans">
					<Toolbar />
					<main className="flex-1 grid grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)_24rem] min-h-0 overflow-hidden">
						<aside className="border-r border-white/[0.05] overflow-y-auto p-3">
							<EntryList />
						</aside>
						<section className="overflow-y-auto">
							<ItemEditor />
						</section>
						<div className="hidden lg:block min-h-0">
							<JsonPreview />
						</div>
					</main>
				</div>
			</TranslationSettingsContext.Provider>
		</MenuStoreContext.Provider>
	);
}
