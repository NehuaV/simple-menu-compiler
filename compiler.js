#!/usr/bin/env node
"use strict";

/**
 * menu-compiler  –  compile a menu JSON → single self-contained HTML file
 *
 * Usage:
 *   node compiler.js [menuFile] [options]
 *
 * Options:
 *   --input  -i   Path to menu JSON              (default: sample-menu.json)
 *   --output -o   Path for the output HTML file  (default: menu.html)
 *   --locale -l   Initial locale to render       (default: en)
 *   --name   -n   Restaurant / menu title        (default: "Our Menu")
 *   --help   -h   Show this help
 */

require("@babel/register")({
	presets: [
		["@babel/preset-env", { targets: { node: "current" } }],
		["@babel/preset-react", { runtime: "automatic" }],
	],
	extensions: [".jsx", ".js"],
	cache: false,
});

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function getArg(flags, fallback) {
	for (let i = 0; i < args.length; i++) {
		if (flags.includes(args[i]) && args[i + 1]) return args[i + 1];
	}
	if (flags.includes("--input") && args[0] && !args[0].startsWith("-"))
		return args[0];
	return fallback;
}

if (args.includes("--help") || args.includes("-h")) {
	console.log(`
menu-compiler  –  compile a menu JSON into a single HTML file

Usage:
  node compiler.js [menuFile] [options]

Options:
  --input  -i   Path to menu JSON              (default: sample-menu.json)
  --output -o   Path for the output HTML file  (default: menu.html)
  --locale -l   Initial locale                 (default: en)
  --name   -n   Restaurant / menu title        (default: "Our Menu")
  --help   -h   Show this help

Examples:
  node compiler.js sample-menu.json
  node compiler.js -i my-menu.json -o dist/index.html -n "Trattoria Roma" -l it
`);
	process.exit(0);
}

const inputFile = getArg(
	["--input", "-i"],
	path.join(__dirname, "sample-menu.json"),
);
const outputFile = getArg(
	["--output", "-o"],
	path.join(__dirname, "menu.html"),
);
const initialLocale = getArg(["--locale", "-l"], "en");
const restaurantName = getArg(["--name", "-n"], "Our Menu");

let menuData;
try {
	menuData = JSON.parse(fs.readFileSync(path.resolve(inputFile), "utf8"));
} catch (err) {
	console.error(`✗ Could not read menu file: ${inputFile}\n  ${err.message}`);
	process.exit(1);
}

// ── Tailwind theme (kept inline so the compiler stays single-file) ───────────
const tailwindConfig = {
	content: [
		path.join(__dirname, "src/**/*.{js,jsx}"),
	],
	theme: {
		extend: {
			colors: {
				bg: "#0e0d0b",
				surface: "#1a1814",
				surface2: "#242118",
				gold: "#c9a84c",
				"gold-light": "#e8c97a",
				text: "#ede8df",
				"text-soft": "#bdb3a4",
				"text-muted": "#8a8070",
			},
			fontFamily: {
				serif: ["'Cormorant Garamond'", "Georgia", "serif"],
				sans: ["'DM Sans'", "'Helvetica Neue'", "sans-serif"],
			},
			screens: {
				xs: "420px",
			},
			boxShadow: {
				card: "0 8px 32px rgba(0,0,0,0.5)",
			},
			keyframes: {
				fadeIn: {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
				slideUp: {
					"0%": { opacity: "0", transform: "translateY(24px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
			},
			animation: {
				fadeIn: "fadeIn 180ms ease both",
				slideUp: "slideUp 240ms cubic-bezier(0.4,0,0.2,1) both",
			},
		},
	},
	plugins: [
		({ addUtilities }) => {
			addUtilities({
				".no-scrollbar": {
					"scrollbar-width": "none",
					"-ms-overflow-style": "none",
				},
				".no-scrollbar::-webkit-scrollbar": { display: "none" },
			});
		},
	],
};

const CSS_INPUT = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { scroll-behavior: smooth; }
  body {
    background-color: #0e0d0b;
    color: #ede8df;
    -webkit-font-smoothing: antialiased;
    font-family: 'DM Sans', 'Helvetica Neue', sans-serif;
    min-height: 100vh;
  }
  ::selection { background: rgba(201,168,76,0.35); color: #ede8df; }
}
`;

(async () => {
	console.log("⚙  Rendering server-side HTML…");
	const React = require("react");
	const { renderToString } = require("react-dom/server");
	const MenuApp = require("./src/MenuApp.jsx").default;

	const appHtml = renderToString(
		React.createElement(MenuApp, {
			menuData,
			initialLocale,
			restaurantName,
		}),
	);

	console.log("⚙  Bundling client-side JavaScript…");
	const esbuild = require("esbuild");
	const buildResult = esbuild.buildSync({
		entryPoints: [path.join(__dirname, "src/client.jsx")],
		bundle: true,
		write: false,
		format: "iife",
		target: ["es2018"],
		minify: true,
		define: { "process.env.NODE_ENV": '"production"' },
	});
	const clientJs = buildResult.outputFiles[0].text;

	console.log("⚙  Compiling Tailwind CSS…");
	const postcss = require("postcss");
	const tailwindcss = require("tailwindcss");
	const autoprefixer = require("autoprefixer");

	const cssResult = await postcss([
		tailwindcss({
			...tailwindConfig,
			content: [
				...tailwindConfig.content,
				{ raw: appHtml, extension: "html" },
			],
		}),
		autoprefixer,
	]).process(CSS_INPUT, { from: undefined });

	const css = cssResult.css;

	const html = `<!DOCTYPE html>
<html lang="${initialLocale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0e0d0b" />
  <meta name="description" content="${restaurantName} — Menu" />
  <title>${restaurantName}</title>
  <style>${css}</style>
</head>
<body>
  <div id="app">${appHtml}</div>

  <script>
    window.__MENU_DATA__       = ${JSON.stringify(menuData)};
    window.__INITIAL_LOCALE__  = ${JSON.stringify(initialLocale)};
    window.__RESTAURANT_NAME__ = ${JSON.stringify(restaurantName)};
  </script>
  <script>${clientJs}</script>
</body>
</html>`;

	const outDir = path.dirname(path.resolve(outputFile));
	if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
	fs.writeFileSync(path.resolve(outputFile), html, "utf8");

	const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
	console.log(`✓ Compiled → ${outputFile}  (${kb} KB)`);
})().catch((err) => {
	console.error("✗ Compilation failed:", err);
	process.exit(1);
});
