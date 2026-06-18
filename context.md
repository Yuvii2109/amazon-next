# Project Context

## Overview

This workspace is a TanStack Start + React storefront branded as Amazon Next. The app is a single-page shopping experience with a strong AI-first concept: users describe an intent, receive a curated bundle, and can add recommended items to a cart or checkout immediately.

## Stack

- TanStack Start for SSR and file-based routing
- TanStack Router for route definitions and root shell composition
- React 19
- Vite for the build pipeline
- Tailwind CSS v4 with `@tailwindcss/vite`
- shadcn/ui-style component primitives in `src/components/ui`
- Nitro for the server build target
- Zod, React Hook Form, Sonner, Recharts, Lucide icons, and several Radix UI primitives

## Backend

The workspace includes a separate FastAPI backend in `backend/` for the e-commerce prototype.

- FastAPI with CORS enabled for `http://localhost:8080`
- Pydantic models for `Product`, `CartResponse`, and the Gemini intent request body
- In-memory mock catalog containing 304 diverse grocery, pantry, and household items priced realistically in INR, generated via a programmatic seeding script (`seed_catalog.py`)
- Curated image mapping using high-quality, category-specific Unsplash production image URLs assigned directly to each product item record
- `GET /api/restock/{category}` maps legacy URL labels (e.g., `coffee` and `produce`) to modern catalog categories (`Beverages` and `Fresh Produce`) using case-insensitive partial matching, returning a subset slice inside a `CartResponse`
- `POST /api/intent` uses `google-genai` with `python-dotenv` and the `gemini-3.1-flash-lite` model to turn user intent plus the full 304-item inventory catalog into a tailored `CartResponse`
- `GET /api/health` returns a simple status payload for readiness checks
- Backend dependencies are listed in `backend/requirements.txt`
- The Gemini API key is stored locally in `backend/.env` via `GEMINI_API_KEY`

## Entry Points

- `src/routes/__root.tsx`: root document shell, shared metadata, app-wide layout, error and not-found surfaces
- `src/routes/index.tsx`: the main storefront experience
- `src/router.tsx`: router factory and query client wiring
- `src/start.ts`: TanStack Start middleware wrapper with SSR error recovery
- `src/server.ts`: server entry wrapper that catches catastrophic SSR failures and normalizes h3-swallowed errors

## App Behavior

The homepage simulates an AI shopping assistant and a curated retail surface.

- The navbar shows traditional search, location, cart state, and account affordances
- An emergency banner promotes a prebuilt monsoon cart
- The intent engine accepts natural language queries, handles async bundle generation via Gemini, and exposes a staging area for verification before cart commitment
- Smart restock cards surface recurring purchases such as coffee, produce, and household essentials, mapping directly to live FastAPI restock endpoints
- The category grid shows promotional shopping tiles
- The cart drawer supports quantity changes, removal, clearing, and checkout simulation
- The checkout modal confirms a bundle or cart order once the user completes the flow

## Route Structure

- `/` is the only visible route in the current app
- `__root.tsx` provides the app shell and wraps child routes with `QueryClientProvider`
- `routeTree.gen.ts` is generated and should not be edited by hand

## Styling

- Global styles live in `src/styles.css`
- The current palette is neutral and retail-oriented, with light and dark theme tokens defined through CSS variables
- Tailwind utility classes are used heavily in the route components

## Error Handling

- Client-side root route errors render a friendly recovery screen with retry and home actions
- Server-side middleware in `src/start.ts` returns a static error page on unexpected failures
- `src/server.ts` captures swallowed SSR errors and converts them into the same error page
- The previous vendor-specific error reporter was removed; console logging and the existing SSR recovery path remain

## Config

- `vite.config.ts` now composes the equivalent standard plugins directly instead of using a wrapper package
- `bunfig.toml` only keeps the general 24-hour package age guard
- `tsconfig.json` keeps bundler resolution and the `@/*` path alias
- `components.json` is configured for shadcn/ui with the `new-york` style and Tailwind v4

## Useful Files

- `src/lib/error-capture.ts`: captures the last server-side thrown error so SSR can recover a stack after h3 normalizes it
- `src/lib/error-page.ts`: static HTML fallback error page
- `src/lib/config.server.ts`: server-only environment access example
- `src/lib/api/example.functions.ts`: backend-facing `createServerFn` wrappers for `generateIntentCart` and `fetchSmartRestock`
- `src/hooks/use-mobile.tsx`: simple viewport breakpoint hook
- `src/components/ui/*`: reusable UI primitives

## Development Commands

- `npm run dev`: start the app in development
- `npm run build`: create a production build
- `npm run lint`: run ESLint across the workspace
- `npm run format`: format the repository with Prettier

## Working Notes

- Keep future app changes documented here so later sessions can reconstruct the project quickly
- Avoid reintroducing vendor-specific branding or telemetry unless there is a deliberate reason

## Recent Changes

- Removed Lovable-specific runtime and branding traces from the app source.
- Replaced the Lovable Vite wrapper with direct Vite, React, Tailwind, TanStack Start, Nitro, and tsconfig-paths plugin setup.
- Added a living `context.md` file to capture the app's structure and future changes.
- Tightened responsiveness in the main storefront route, including the hero, product grids, drawer, modal, footer, and cart flow.
- Reworked the navbar into responsive desktop and phone layouts so the cart stays aligned and does not wrap below the search bar on mobile.
- Verified the current state with a successful `npm run build`.
- Added a new `backend/` FastAPI service with Gemini-powered intent handling, mock inventory data, and a health endpoint.
- Verified the backend package compiles successfully with `compileall` and that the intent path works against a mocked Gemini client.
- Replaced the mock storefront API layer with TanStack Start server functions that call the FastAPI backend for intent generation and smart restock.
- Wired the `Generate My Cart` flow to `generateIntentCart` and the `1-Click Restock` buttons to `fetchSmartRestock`, including loading states and direct modal/cart updates.
- Created `seed_catalog.py` to scale the backend mock repository to 304 items across 8 comprehensive categories, fully embedding mapped high-fidelity Unsplash imagery.
- Patched backend routing filters to translate incoming legacy categories (`coffee`, `produce`) to match the newly generated catalog labels with a partial-match case-insensitive fallback.
- Transitioned the intent engine frontend to a curated preview flow utilizing a local `suggestedBundle` state variable. Results render as an isolated horizontal "Curated AI Box" preview track, letting users explicitly control cart ingestion through dedicated "Add Full Bundle to Cart" or individual item "+" buttons.
- Added a tiered discount system to the cart and checkout UI to increase Average Order Value. Five tiers: ₹1000→₹100 off, ₹2000→₹150, ₹3000→₹200, ₹4000→₹250, ₹5000→₹300. Includes a `DISCOUNT_TIERS` constant, a `getDiscountInfo()` helper, and a reusable `DiscountBanner` component.
- Cart Drawer now shows a gamified progress banner (blue nudge below threshold, green celebration when unlocked, progressive nudge toward next tier). Footer displays Subtotal, conditional Discount line in green, and the discounted Total.
- Checkout Modal displays a "You saved ₹X" celebration banner when a discount was applied, plus a full Subtotal → Discount → Total receipt breakdown.
- Updated the Gemini system instruction for `POST /api/intent` to act as an expert retail merchandiser that curates the core bundle to cross the ₹1000 promotion threshold (₹1000–₹1150 sweet spot) while fulfilling the user's intent.
- Extended `CartResponse` Pydantic model with an optional `extras: List[Product] = []` field for additional product suggestions beyond the core bundle.
- Updated the Gemini prompt to return 8–12 additional relevant items in the `extras` array (alternatives and complementary products that did not make the core bundle).
- Removed `responseSchema` from the Gemini config to avoid SDK schema conversion issues with the updated model; relying on `responseMimeType="application/json"` plus explicit prompt instructions instead.
- Frontend now receives and renders `extras` in a "More for This Occasion / You might also like" grid section below the Curated AI Box, using the same `ProductCard` component.
- Fixed uneven product card heights: removed `pr-10` from image container, added `h-full` to cards, pinned price to bottom with `mt-auto`, added `z-10` to the add button.
- Bundle preview track uses fixed-width cards (`w-[200px]`/`sm:w-[220px]`) in a horizontal scroll layout for visual consistency while the extras section uses a responsive grid.
- Added CSRF middleware to `src/start.ts` protecting all server function endpoints from cross-origin requests.
- Added `GET /api/search?q=<query>` backend endpoint with multi-term keyword scoring against product name and category, returning top 12 matches.
- Added `searchProducts` server function in `example.functions.ts` to call the search endpoint.
- Wired the Navbar search bar (both desktop and mobile) to be fully functional: debounced input (300ms), dropdown overlay with product thumbnails/prices/add-to-cart buttons, Escape/click-outside dismiss, and loading/empty states.
- Restock cards now fetch live data from the backend on mount, replacing hardcoded bundle prices with actual catalog values so pre-click and post-click totals match.
- Replaced the "1-Click Restock" direct-to-checkout flow with a `RestockPreviewModal` that lets users select/deselect items before adding to cart. Users curate their restock selection, then proceed through the normal cart → checkout flow.
- New `RestockPreviewModal` component: shows all restock items with checkboxes (all selected by default), select all/clear buttons, running selected total, and "Add X items to Cart" action that moves selected items into the main cart drawer.
- Upgraded `POST /api/intent` to a RAG (Retrieval-Augmented Generation) architecture: embeddings for all 304 catalog items are generated via `gemini-embedding-001`, cached to disk as `_catalog_embeddings.npy`, and loaded into memory at startup. Per-request, the user query is embedded and top-40 items are retrieved via numpy cosine similarity before passing to Gemini.
- Added `numpy` to backend dependencies and a `/api/warmup` endpoint for explicit embedding pre-load.
- Added `lifespan` startup event in `main.py` to pre-load embeddings on server boot for fast first-request latency.
- Embedding builder includes retry-with-backoff (30s, 60s) on 429 rate limits to handle free-tier throttling gracefully.
- Introduced a multi-tier bundle system: the intent endpoint now returns 1–3 price-tier bundles ("Smart Saver", "Popular Choice", "Premium Selection") instead of a single curated combo, plus shared extras.
- New Pydantic models: `TieredBundle` (name, items, total_cost) and `IntentResponse` (bundles: List[TieredBundle], extras). `CartResponse` remains unchanged for restock/search.
- Gemini prompt updated to instruct the LLM to organize retrieved items into up to 3 distinct price tiers, each crossing the ₹1000 discount threshold, with fallback to fewer tiers when catalog variety is insufficient.
- Frontend `IntentEngine` rewritten to display tier options as styled tab buttons (green for Smart Saver, blue for Popular Choice, amber for Premium Selection) with the active tier's products shown in the scrollable card track. Defaults to "Popular Choice" when 3 tiers exist.
- Extras section is now shared across all tiers rather than per-bundle.
- Fixed restock price mismatch: removed the redundant second fetch on button click. The preview modal now uses the same data already loaded on mount, ensuring card price and modal total always match.
- Switched catalog data source from `mock_db.py` (304 Unsplash-based items) to `mock_db_new.py` (150 BigBasket-sourced items with real product images and realistic INR pricing). Old file retained for rollback.
- Updated `RESTOCK_CATEGORY_MAP` to match new category names: `produce → "Fruits & Vegetables"`, `household → "Cleaning & Household"`, `coffee → "Beverages"`.
- Deleted cached `_catalog_embeddings.npy` to force rebuild with the new catalog on next server start.
- Updated `mock_db_new.py` to 1,075 items. Rebuilt embeddings with a fresh API key; `_catalog_embeddings.npy` is now cached on disk.
- Added product deduplication logic to the restock endpoint: `_base_product_name()` strips size/quantity suffixes and variant descriptors, groups items by base identity, and picks one mid-price representative per group. `_select_diverse_products()` ensures 6 distinct product types per restock card.
- Added category-specific priority sorting so each restock card shows the most relevant staples first (e.g., Beans/Brinjal/Bitter Gourd for Produce; Liquid Handwash/Antiseptic Disinfectant/Bathing Soap Cool for Household).
- Renamed first restock card from "Monthly Coffee & Dairy Restock" to "Monthly Tea & Drinks Restock" with subtitle "Your daily chai & beverage picks".
- Changed household restock category mapping from "Cleaning & Household" to "Beauty & Hygiene" for better image availability and product variety.
- Added `onError` image fallback handlers across all product images (ProductCard, RestockCard thumbnails, search dropdown, cart drawer, restock preview modal, checkout modal) — broken URLs now hide cleanly, showing the neutral gray background.
- Navbar personalization: delivery pin updated to 110085, greeting changed to "Hello, Yuvraj".
- Intent chips updated: replaced "Monsoon prep essentials" and "Birthday party for a 7-year-old" with "Weekly grocery essentials for a family of 4" and "Dog food and pet care supplies" to match available catalog data.