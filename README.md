# menu-compiler

Compile a restaurant menu JSON file into a single, self-contained, mobile-friendly HTML page. The output includes server-rendered markup, an inline client bundle, search, item detail modals, a sticky section nav bar that scrolls to any section, and automatic multi-language support.

## Quick start

```bash
npm install
node compiler.js sample-menu.json
```

This reads `sample-menu.json` and writes `menu.html`. Open the HTML file in any browser — no server required.

## Project structure

```
menu-compiler/
├── compiler.js          # Compiler entry point (CLI + build pipeline)
├── src/
│   ├── MenuApp.jsx      # React component (SSR + client)
│   └── client.jsx       # Hydration entry point
├── sample-menu.json     # Example menu data
└── package.json
```

## How it works

The build pipeline produces one portable HTML file:

1. **SSR** — `react-dom/server` renders `MenuApp` to an HTML string using your menu data and chosen locale.
2. **Client bundle** — `esbuild` bundles `client.jsx` and React into an inline `<script>` (no separate asset files).
3. **Styles** — PostCSS runs Tailwind against the JSX sources and the rendered HTML, producing a minimal CSS bundle with only the utilities actually used.
4. **Assembly** — SSR markup, generated CSS, embedded menu JSON, and the script are combined into a single `.html` file.

The page hydrates on load so search, locale switching, the section nav, and item modals work interactively.

### Section nav

A sticky pill bar below the header lists every section in your menu. Tapping a pill smooth-scrolls to that section, and the active pill is automatically highlighted as you scroll (via `IntersectionObserver`). The bar scrolls horizontally on narrow screens so it works even with many sections.

### Mobile

The layout is built mobile-first with Tailwind: the header stacks brand on top of search + locale on small screens, cards collapse to a single column below 420px and two columns up to `lg`, and the item modal slides up as a bottom sheet on mobile while staying a centered card on desktop.

## CLI usage

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
{ "type": "item", "section": "starters", "name": { "en": "Bruschetta" }, "price": { "amount": 8.50, "currency": "€" } }
```

If no sections are defined, items are grouped automatically by their `category` field.

### Items

Supported fields on `"type": "item"` entries:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` or `{ locale: string }` | Item name (localized) |
| `description` | `string` or `{ locale: string }` | Long description |
| `category` | `string` or `{ locale: string }` | Category label (used for grouping when no sections exist) |
| `price` | `{ amount, currency }` or `string/number` | Price display |
| `tags` | `string[]` | Dietary / style tags (e.g. `vegetarian`, `gluten-free`) |
| `allergens` | `string[]` | Allergen list shown in the detail modal |
| `calories` | `number` | Calorie count |
| `image` | `string` | Image URL for card and modal |
| `section` | `string` | Section `id` this item belongs to |

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
  "image": "https://example.com/gelato.jpg"
}
```

## Localization

Any field that accepts a plain string can also be an object keyed by locale code:

```json
{ "name": { "en": "Starters", "it": "Antipasti", "fr": "Entrées" } }
```

The compiler detects all locales present in `name`, `description`, and `category` fields. A locale switcher appears in the header whenever more than one locale is found. Use `--locale` / `-l` to set which language renders first.

Fallback order for a missing translation: requested locale → `en` → first available value.

## Styling

Styles are written as Tailwind utility classes in `src/MenuApp.jsx`. The theme (colors, fonts, animations) is configured inline in `compiler.js` — edit `tailwindConfig` there to retheme. The Tailwind palette adds:

- `bg`, `surface`, `surface2` — dark backgrounds
- `gold`, `gold-light` — accent
- `text`, `text-soft`, `text-muted` — typography shades
- `font-serif` (Cormorant Garamond), `font-sans` (DM Sans)
- `animate-fadeIn`, `animate-slideUp` — modal animations
- `xs` breakpoint at 420px and a `no-scrollbar` utility

## Output

The generated HTML is fully self-contained — CSS, JavaScript, and menu data are embedded inline. You can host it on any static file server, attach it to an email, or open it locally.

See `sample-menu.json` for a complete working example and `menu.html` (or `dist/index.html`) for sample compiled output.
