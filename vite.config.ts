import { defineConfig } from "vite";
import path from "node:path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// Tailwind theme for the menu-builder app. Kept in sync with the runtime theme
// in compiler.js so the editor matches the final compiled menu's look.
const tailwindConfig = {
	content: [
		path.resolve(__dirname, "srcApp/index.html"),
		path.resolve(__dirname, "srcApp/**/*.{ts,tsx}"),
	],
	theme: {
		extend: {
			colors: {
				bg: "#0e0d0b",
				surface: "#1a1814",
				surface2: "#242118",
				surface3: "#2f2b21",
				gold: "#c9a84c",
				"gold-light": "#e8c97a",
				text: "#ede8df",
				"text-soft": "#bdb3a4",
				"text-muted": "#8a8070",
				danger: "#d96a4a",
			},
			fontFamily: {
				serif: ["'Cormorant Garamond'", "Georgia", "serif"],
				sans: ["'DM Sans'", "'Helvetica Neue'", "sans-serif"],
				mono: [
					"'JetBrains Mono'",
					"ui-monospace",
					"SFMono-Regular",
					"monospace",
				],
			},
			screens: { xs: "420px" },
			boxShadow: { card: "0 8px 32px rgba(0,0,0,0.5)" },
		},
	},
	plugins: [],
};

// Vite is rooted at srcApp/ so the menu-builder app lives in its own folder
// and doesn't collide with the existing compiler.js pipeline at the repo root.
// JSX is configured via esbuild (preset-free) so the project keeps a single
// dependency boundary with the rest of the menu-compiler project.
export default defineConfig({
	root: path.resolve(__dirname, "srcApp"),
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "preact",
	},
	resolve: {
		alias: {
			react: "preact/compat",
			"react-dom": "preact/compat",
			"react/jsx-runtime": "preact/jsx-runtime",
		},
	},
	css: {
		postcss: {
			plugins: [tailwindcss(tailwindConfig), autoprefixer()],
		},
	},
	build: {
		outDir: path.resolve(__dirname, "dist-app"),
		emptyOutDir: true,
		target: "esnext",
	},
	server: {
		port: 5173,
		open: true,
		fs: {
			allow: [path.resolve(__dirname)],
		},
	},
});
