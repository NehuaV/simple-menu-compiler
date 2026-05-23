import React from "react";
import { hydrateRoot } from "react-dom/client";
import MenuApp from "./MenuApp.jsx";

const root = document.getElementById("app");
const menuData = window.__MENU_DATA__ ?? [];
const initialLocale = window.__INITIAL_LOCALE__ ?? "en";
const restaurantName = window.__RESTAURANT_NAME__ ?? "Our Menu";

hydrateRoot(
	root,
	React.createElement(MenuApp, { menuData, initialLocale, restaurantName }),
);
