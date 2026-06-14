# Amazon Next — AI-First Shopping Platform

A zero-friction, AI-powered grocery and household e-commerce storefront. Users describe what they need in natural language, and the system assembles curated, price-optimized product bundles using Retrieval-Augmented Generation (RAG) with Google Gemini.

**Live on AWS**: Deployed on an Amazon EC2 t3.micro instance.

---

## Key Features

### AI Intent Engine
- Natural language input → multi-tier curated bundles
- RAG pipeline: semantic embeddings (gemini-embedding-001) retrieve top-40 relevant items from a 1,075-product catalog, then Gemini 2.5 Flash assembles price-tier bundles
- Three pricing tiers per query: **Smart Saver**, **Popular Choice**, **Premium Selection**
- "You might also like" extras section with 6–10 complementary items

### Gamified Discount System
- Five progressive discount tiers to increase Average Order Value:
  - ₹1,000 spend → ₹100 off
  - ₹2,000 spend → ₹150 off
  - ₹3,000 spend → ₹200 off
  - ₹4,000 spend → ₹250 off
  - ₹5,000 spend → ₹300 off
- Dynamic progress banners in the cart drawer and checkout modal
- Gemini is instructed to target the ₹1,000 threshold in bundle curation

### Smart Restock
- Predictive restock cards for Tea & Drinks, Fresh Produce, and Household Essentials
- Products fetched live from the backend with intelligent deduplication (no duplicate size variants)
- Category-specific priority sorting surfaces the most relevant staples first
- Restock Preview Modal lets users select/deselect items before adding to cart

### Live Product Search
- Debounced search bar (300ms) with dropdown overlay
- Multi-term keyword scoring against product name and category
- Instant add-to-cart from search results

### Full Cart & Checkout Flow
- Cart drawer with quantity controls, item removal, and clearing
- Receipt breakdown: Subtotal → Discount → Total
- Checkout confirmation with savings celebration

---

## Tech Stack

### Frontend

<table>
  <thead>
    <tr>
      <th>Technology</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>TanStack Start</td>
      <td>SSR, file-based routing, server functions</td>
    </tr>
    <tr>
      <td>React 19</td>
      <td>UI framework</td>
    </tr>
    <tr>
      <td>Vite</td>
      <td>Build pipeline</td>
    </tr>
    <tr>
      <td>Tailwind CSS v4</td>
      <td>Utility-first styling</td>
    </tr>
    <tr>
      <td>shadcn/ui</td>
      <td>Component primitives (New York style)</td>
    </tr>
    <tr>
      <td>Nitro</td>
      <td>Server build target</td>
    </tr>
    <tr>
      <td>Zod</td>
      <td>Input validation</td>
    </tr>
    <tr>
      <td>Lucide React</td>
      <td>Icons</td>
    </tr>
  </tbody>
</table>

### Backend

<table>
  <thead>
    <tr>
      <th>Technology</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>FastAPI</td>
      <td>REST API framework</td>
    </tr>
    <tr>
      <td>Google Gemini 2.5 Flash</td>
      <td>LLM for bundle generation</td>
    </tr>
    <tr>
      <td>gemini-embedding-001</td>
      <td>Semantic embeddings for RAG retrieval</td>
    </tr>
    <tr>
      <td>NumPy</td>
      <td>Cosine similarity computation</td>
    </tr>
    <tr>
      <td>Pydantic</td>
      <td>Data validation and serialization</td>
    </tr>
    <tr>
      <td>python-dotenv</td>
      <td>Environment variable management</td>
    </tr>
  </tbody>
</table>

---

## Project Structure

```
├── src/
│   ├── routes/
│   │   ├── __root.tsx          # App shell, metadata, error boundaries
│   │   └── index.tsx           # Main storefront (all UI components)
│   ├── lib/
│   │   └── api/
│   │       └── example.functions.ts  # Server functions (intent, restock, search)
│   ├── components/ui/          # Reusable UI primitives
│   ├── start.ts                # CSRF + error middleware
│   └── styles.css              # Global styles + theme tokens
├── backend/
│   ├── main.py                 # FastAPI app with lifespan embedding preload
│   ├── routes.py               # API endpoints (intent, restock, search, health)
│   ├── models.py               # Pydantic schemas (Product, CartResponse, IntentResponse)
│   ├── mock_db_new.py          # 1,075-item product catalog (BigBasket data)
│   ├── _catalog_embeddings.npy # Precomputed embedding vectors (cached)
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # GEMINI_API_KEY (not committed)
├── context.md                  # Living project documentation
├── package.json                # Node dependencies and scripts
└── vite.config.ts              # Vite + TanStack Start + Tailwind config
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- A Google Gemini API key

### Frontend Setup
```bash
npm install
npm run dev
```
The frontend runs on `http://localhost:8080`.

### Backend Setup
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env`:
```
GEMINI_API_KEY=your_key_here
```

Start the backend:
```bash
uvicorn backend.main:app --reload --port 8000
```

On first boot, the server embeds all 1,075 catalog items and caches the result to `_catalog_embeddings.npy`. Subsequent starts load instantly from disk.

---

## API Endpoints

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>POST</td>
      <td><code>/api/intent</code></td>
      <td>RAG pipeline → multi-tier bundles + extras</td>
    </tr>
    <tr>
      <td>GET</td>
      <td><code>/api/restock/{category}</code></td>
      <td>Deduplicated category restock (6 items)</td>
    </tr>
    <tr>
      <td>GET</td>
      <td><code>/api/search?q=&lt;query&gt;</code></td>
      <td>Keyword search (top 12 results)</td>
    </tr>
    <tr>
      <td>GET</td>
      <td><code>/api/health</code></td>
      <td>Readiness check</td>
    </tr>
    <tr>
      <td>GET</td>
      <td><code>/api/warmup</code></td>
      <td>Manually trigger embedding preload</td>
    </tr>
  </tbody>
</table>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (SSR)                       │
│  TanStack Start + React 19 + Tailwind CSS v4                │
│  Server Functions → CSRF Protected                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP (localhost:8000)
┌─────────────────────▼───────────────────────────────────────┐
│                     FastAPI Backend                         │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐   │
│  │  Embedding  │    │   RAG        │    │   Gemini      │   │
│  │  Vector     │───>│   Retrieval  │───>│   2.5 Flash   │   │
│  │  Store      │    │   (Top 40)   │    │   Generation  │   │
│  │  (.npy)     │    └──────────────┘    └───────────────┘   │
│  └─────────────┘                                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1,075-Item Catalog (mock_db_new.py)                │    │
│  │  Categories: Fruits & Veg, Beverages, Bakery,       │    │
│  │  Foodgrains, Snacks, Beauty, Cleaning, Pets, etc.   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Production Build

```bash
npm run build
```

Outputs to `.output/` with Nitro targeting Cloudflare Workers (configurable via `nitro.config`).

---

## Deployment

Currently deployed on **AWS EC2 t3.micro**:
- Frontend: Nitro SSR server
- Backend: Uvicorn serving FastAPI
- Embeddings cached on disk for instant cold starts

---

## Scripts

<table>
  <thead>
    <tr>
      <th>Command</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>npm run dev</code></td>
      <td>Start frontend in development mode</td>
    </tr>
    <tr>
      <td><code>npm run build</code></td>
      <td>Production build</td>
    </tr>
    <tr>
      <td><code>npm run lint</code></td>
      <td>ESLint check</td>
    </tr>
    <tr>
      <td><code>npm run format</code></td>
      <td>Prettier formatting</td>
    </tr>
  </tbody>
</table>

---

## Environment Variables

<table>
  <thead>
    <tr>
      <th>Variable</th>
      <th>Location</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>GEMINI_API_KEY</code></td>
      <td><code>backend/.env</code></td>
      <td>Google Gemini API key for embeddings and generation</td>
    </tr>
  </tbody>
</table>

---

## License

Prototype project. Not for commercial redistribution.
