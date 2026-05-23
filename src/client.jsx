import { hydrate, h } from "preact";
import MenuApp from "./MenuApp.jsx";

const root = document.getElementById("app");
const menuData = window.__MENU_DATA__ ?? [];
const initialLocale = window.__INITIAL_LOCALE__ ?? "en";
const restaurantName = window.__RESTAURANT_NAME__ ?? "Our Menu";

hydrate(h(MenuApp, { menuData, initialLocale, restaurantName }), root);
