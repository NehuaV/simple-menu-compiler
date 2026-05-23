# menu-compiler

Compile a restaurant menu JSON file into a **single, self-contained, mobile-friendly HTML page**. SSR'd with Preact, styled with Tailwind, and packed with niceties: progressive image loading with IndexedDB caching, a flag-icon language dropdown, a sticky section nav bar, search, and item-detail modals — all embedded in one `.html` file you can host anywhere or email as an attachment.

## Quick start

```bash
npm install
node compiler.js sample-menu.json
```

This reads `sample-menu.json` and writes `menu.html`. Open the HTML file in any browser — no server required.

## Project structure

```
menu-compiler/
├── compiler.js          # CLI + build pipeline (SSR, esbuild, Tailwind, flag inliner)
├── src/
│   ├── MenuApp.jsx      # Preact component (SSR + hydration target)
│   └── client.jsx       # Hydration entry point
├── sample-menu.json     # Example menu data
└── package.json
```

## Build pipeline

The compiler produces a single self-contained HTML file:

1. **SSR** — `preact-render-to-string` renders `MenuApp` to an HTML string using your menu data and chosen locale.
2. **Client bundle** — `esbuild` bundles `client.jsx` and Preact into an inline `<script>` (no separate asset files). The bundle uses Preact's JSX runtime (`jsxImportSource: "preact"`).
3. **Styles** — PostCSS runs Tailwind against the JSX sources and the rendered HTML, producing a minimal CSS bundle with only the utilities actually used. The Tailwind theme is configured inline in `compiler.js`.
4. **Flags** — Only the country flags for locales present in your menu data are read from `node_modules/flag-icons/flags/4x3/` and embedded as `data:image/svg+xml` background-image rules.
5. **Assembly** — SSR markup, generated CSS, embedded menu JSON, and the script are concatenated into one `.html` file.

Why Preact instead of React: roughly **3× smaller** output. With the sample menu the compiled file is ≈ **110 KB total** (≈ 28 KB CSS, ≈ 65 KB JS — Preact + localforage + app code — and ≈ 17 KB SSR markup) versus ≈ 243 KB with React.

## CLI

```bash
node compiler.js [menuFile] [options]
```

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--input` | `-i` | Path to menu JSON | `sample-menu.json` |
| `--output` | `-o` | Output HTML path | `menu.html` |
| `--locale` | `-l` | Initial locale | `en` |
| `--name` | `-n` | Restaurant / menu title | `Our Menu` |
| `--help` | `-h` | Show help | — |

### Examples

```bash
# Basic — positional input file
node compiler.js my-menu.json

# Full options
node compiler.js -i sample-menu.json -o dist/index.html -n "Trattoria Roma" -l it
```

## Menu JSON format

The menu file is a JSON **array** of entries. Each entry has a `type` field (or defaults to an item).

### Sections

Use `"type": "section"` to define menu groups. Items reference a section via `section` (or `sectionId`):

```json
{ "type": "section", "id": "starters", "name": { "en": "Starters", "it": "Antipasti" } }
```

```json
{ "type": "item", "section": "starters", "name": { "en": "Bruschetta" } }
```

If no sections are defined, items are grouped automatically by their `category` field.

### Items

Supported fields on `"type": "item"` entries:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` or `{ locale: string }` | Item name (localized) |
| `description` | `string` or `{ locale: string }` | Long description |
| `category` | `string` or `{ locale: string }` | Category label (used for grouping when no sections exist) |
| `price` | `{ amount, currency }` or `string`/`number` | Price display |
| `tags` | `string[]` | Dietary / style tags (e.g. `vegetarian`, `gluten-free`) |
| `allergens` | `string[]` | Allergen list shown in the detail modal |
| `calories` | `number` | Calorie count |
| `image` | `string` or `{ src, placeholder }` | Image — see below |
| `section` | `string` | Section `id` this item belongs to |

### Progressive images

The `image` field supports two forms:

```json
"image": "https://example.com/dish.jpg"
```

```json
"image": {
  "src":         "https://example.com/dish-1200x800.jpg",
  "placeholder": "https://example.com/dish-40x27.jpg"
}
```

When both are provided, the **low-res placeholder is rendered with a heavy `blur-xl` filter underneath** and the **high-res image fades in on top** (`transition-opacity duration-1000`) once it has finished loading. This avoids the "image pop" effect and gives instant visual feedback.

### Example item

```json
{
  "type": "item",
  "name": { "en": "Ice Cream", "it": "Gelato" },
  "description": { "en": "Vanilla bean gelato.", "it": "Gelato alla vaniglia." },
  "category": { "en": "Dessert", "it": "Dolci" },
  "price": { "amount": 7.00, "currency": "€" },
  "tags": ["vegetarian"],
  "allergens": ["dairy"],
  "calories": 280,
  "image": {
    "src":         "https://example.com/gelato-1200.jpg",
    "placeholder": "https://example.com/gelato-40.jpg"
  }
}
```

## Image caching (IndexedDB, 8-hour TTL)

The compiled page uses [`localforage`](https://localforage.github.io/localForage/) to cache high-resolution images in the browser's IndexedDB:

- **First visit** — images load from the network; on each successful load a background `fetch()` stores a copy in IndexedDB with a timestamp.
- **Repeat visit (within 8 h)** — the `<img>`'s `src` is swapped to a `blob:` URL produced from the cached bytes, so **no network request is made for any cached image**.
- **After 8 h** — stale entries are evicted on read; the image is refetched and the cache is refreshed.

The cache lives in an IndexedDB database named `menu-compiler` → store `images`. Each entry is `{ blob: Blob, timestamp: number }`, keyed by the image URL.

If IndexedDB is unavailable (e.g. private browsing in some configurations), the component falls back to direct URL loading — no errors thrown.

## Language switcher

A pill-style dropdown in the header (matches the dark/gold restaurant theme) shows the current language's **country flag + native name** (e.g. UK flag + "English", Italian flag + "Italiano"). Clicking opens a styled menu of all detected locales.

- **Flags** come from the [`flag-icons`](https://flagicons.lipis.dev/) package. Only the SVGs for the locales present in your menu are embedded at compile time, as inline `data:` URLs — no external requests, no bloat.
- **Locale → country mapping** lives in `LOCALE_TO_COUNTRY` in `src/MenuApp.jsx`. Common BCP-47 codes are pre-mapped (`en→gb`, `it→it`, `fr→fr`, `es→es`, `de→de`, `pt→pt`, `ja→jp`, `zh→cn`, `ko→kr`, …). Extend the map for any locale you use.
- **Language names** are produced by the browser's native `Intl.DisplayNames` API in the locale's own language ("Français", "Deutsch", "日本語").
- **A11y**: trigger button has `aria-haspopup="listbox"` and `aria-expanded`; the panel is `role="listbox"`; items are `role="option"` with `aria-selected`. Closes on outside click, Escape, or selection.

## Localization

Any field that accepts a plain string can also be an object keyed by locale code:

```json
{ "name": { "en": "Starters", "it": "Antipasti", "fr": "Entrées" } }
```

The compiler detects all locales present in `name`, `description`, and `category` fields. The language dropdown appears in the header whenever more than one locale is found. Use `--locale` / `-l` to set which language renders first.

Fallback order for a missing translation: requested locale → `en` → first available value.

## Section nav

A sticky pill bar below the header lists every section in your menu. Tapping a pill smooth-scrolls to that section (with `scroll-margin-top` honored so it lands just under the sticky header), and the active pill is auto-highlighted as you scroll via `IntersectionObserver`. The bar scrolls horizontally on narrow screens so it works even with many sections.

## Mobile

The layout is built mobile-first with Tailwind: the header stacks brand on top of search + language dropdown on small screens; cards collapse to a single column below 420px and two columns up to `lg`; and the item modal slides up as a bottom sheet on mobile while staying a centered card on desktop.

## Styling

Styles are written as Tailwind utility classes in `src/MenuApp.jsx`. The theme (colors, fonts, animations) is configured inline in `compiler.js` — edit `tailwindConfig` there to retheme. The Tailwind palette adds:

- `bg`, `surface`, `surface2` — dark backgrounds
- `gold`, `gold-light` — accent
- `text`, `text-soft`, `text-muted` — typography shades
- `font-serif` (Cormorant Garamond), `font-sans` (DM Sans)
- `animate-fadeIn`, `animate-slideUp` — modal animations
- `xs` breakpoint at 420px and a `no-scrollbar` utility

## Dependencies

| Package | Why |
|---------|-----|
| `preact` + `preact-render-to-string` | Tiny React-compatible UI runtime for SSR + hydration |
| `esbuild` | Client-side JS bundling (with Preact JSX runtime) |
| `@babel/register` + presets | JSX transform for the SSR pass in Node |
| `tailwindcss` + `postcss` + `autoprefixer` | Generates a minimal utility CSS bundle |
| `localforage` | IndexedDB-backed image cache |
| `flag-icons` | Country flag SVGs (only used ones get inlined) |

## Output

The generated HTML is fully self-contained — CSS, JavaScript, embedded menu JSON, and country-flag SVGs are all inlined. You can host it on any static file server, attach it to an email, or open it locally. The only external resources fetched at runtime are the Google Fonts stylesheet and the dish images on first load (after that, dish images come from the IndexedDB cache for 8 hours).

See `sample-menu.json` for a working example and `menu.html` (or `dist/index.html` after the example command) for sample compiled output.
