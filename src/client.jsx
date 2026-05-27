import { hydrate, h } from "preact";
import MenuApp from "./MenuApp.jsx";

const root = document.getElementById("app");
const menuData = window.__MENU_DATA__ ?? [];
const initialLocale = window.__INITIAL_LOCALE__ ?? "en";
const restaurantName = window.__RESTAURANT_NAME__ ?? "Our Menu";
const imageCacheVersionTag =
	window.__IMAGE_CACHE_VERSION_TAG__ ?? "menu-images-cache";

hydrate(
	h(MenuApp, {
		menuData,
		initialLocale,
		restaurantName,
		imageCacheVersionTag,
	}),
	root,
);
