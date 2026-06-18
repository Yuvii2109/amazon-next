import json
import os
from pathlib import Path
from typing import List

import numpy as np
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel

from .models import Product, CartResponse, IntentResponse
from .mock_db_new import PRODUCTS

load_dotenv()

router = APIRouter()


class IntentRequest(BaseModel):
    query: str


# ---------------------------------------------------------------------------
# Vector Store — Precomputed embeddings for RAG retrieval
# ---------------------------------------------------------------------------

_EMBEDDING_MODEL = "gemini-embedding-001"
_EMBEDDINGS_CACHE_PATH = Path(__file__).parent / "_catalog_embeddings.npy"
_catalog_embeddings: np.ndarray | None = None
_genai_client: genai.Client | None = None


def _get_genai_client() -> genai.Client:
    """Lazy-initialize the Gemini client."""
    global _genai_client
    if _genai_client is None:
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Missing Google API key in environment")
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client


def _load_or_build_embeddings() -> np.ndarray:
    """Load embeddings from disk cache, or build + cache them with retry."""
    global _catalog_embeddings
    if _catalog_embeddings is not None:
        return _catalog_embeddings

    # Try loading from disk cache
    if _EMBEDDINGS_CACHE_PATH.exists():
        _catalog_embeddings = np.load(str(_EMBEDDINGS_CACHE_PATH))
        print(f"[RAG] Loaded cached embeddings from disk, shape: {_catalog_embeddings.shape}")
        return _catalog_embeddings

    # Build fresh embeddings with retry on rate limits
    import time

    client = _get_genai_client()
    texts = [f"{item['name']} {item.get('category', '')}" for item in PRODUCTS]

    all_embeddings = []
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        # Retry up to 3 times with increasing delay
        for attempt in range(3):
            try:
                response = client.models.embed_content(
                    model=_EMBEDDING_MODEL,
                    contents=batch,
                )
                for embedding in response.embeddings:
                    all_embeddings.append(embedding.values)
                break
            except Exception as e:
                if "429" in str(e) and attempt < 2:
                    wait = (attempt + 1) * 30  # 30s, 60s
                    print(f"[RAG] Rate limited, waiting {wait}s before retry...")
                    time.sleep(wait)
                else:
                    raise

    _catalog_embeddings = np.array(all_embeddings, dtype=np.float32)
    norms = np.linalg.norm(_catalog_embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1
    _catalog_embeddings = _catalog_embeddings / norms

    # Save to disk for instant future loads
    np.save(str(_EMBEDDINGS_CACHE_PATH), _catalog_embeddings)
    print(f"[RAG] Built and cached embeddings, shape: {_catalog_embeddings.shape}")
    return _catalog_embeddings


def _retrieve_top_k(query: str, top_k: int = 40) -> List[dict]:
    """Embed the query and retrieve the top-k most similar catalog items."""
    client = _get_genai_client()
    catalog_embs = _load_or_build_embeddings()

    # Embed the query
    response = client.models.embed_content(
        model=_EMBEDDING_MODEL,
        contents=[query],
    )
    query_emb = np.array(response.embeddings[0].values, dtype=np.float32)
    query_emb = query_emb / (np.linalg.norm(query_emb) or 1.0)

    # Cosine similarity via dot product (both vectors are normalized)
    similarities = catalog_embs @ query_emb

    # Get top-k indices
    top_indices = np.argsort(similarities)[::-1][:top_k]

    return [PRODUCTS[int(idx)] for idx in top_indices]


# ---------------------------------------------------------------------------
# Warmup endpoint — call on server start to pre-load embeddings
# ---------------------------------------------------------------------------

@router.get("/warmup")
def warmup():
    """Pre-load embeddings into memory. Call once after server start."""
    _load_or_build_embeddings()
    return {"status": "warm", "items_embedded": len(PRODUCTS)}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health")
def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Search endpoint
# ---------------------------------------------------------------------------

@router.get("/search", response_model=List[Product])
def search_products(q: str = ""):
    """Search the catalog by keyword matching against product name and category."""
    query = q.strip().lower()
    if not query or len(query) < 2:
        return []

    terms = query.split()
    results: List[tuple[int, dict]] = []

    for product in PRODUCTS:
        name_lower = product["name"].lower()
        category_lower = product.get("category", "").lower()
        searchable = f"{name_lower} {category_lower}"

        score = sum(1 for term in terms if term in searchable)

        if query in name_lower:
            score += 3
        elif query in category_lower:
            score += 1

        if score > 0:
            results.append((score, product))

    results.sort(key=lambda x: (-x[0], x[1]["name"]))

    return [
        Product(id=p["id"], name=p["name"], price=p["price"], image_url=p["image_url"])
        for _, p in results[:12]
    ]


# ---------------------------------------------------------------------------
# Restock
# ---------------------------------------------------------------------------

RESTOCK_CATEGORY_MAP = {
    "coffee": "Beverages",
    "produce": "Fruits & Vegetables",
    "household": "Beauty & Hygiene",
}


import re as _re

_SIZE_PATTERN = _re.compile(
    r"\s*[\(\-]\s*(?:loose\s*)?(?:\d+\s*x\s*)?\d+[\.,]?\d*\s*"
    r"(?:kg|g|ml|l|pcs|pieces|each|pack|tray|rolls?)\b[^)]*\)?"
    r"|\s*\(\s*\d+\s*(?:x\s*\d+\s*)?(?:kg|g|ml|l|pcs|pieces|each|pack)\s*\)",
    _re.IGNORECASE,
)

# Words to strip for grouping purposes (variants, descriptors)
_VARIANT_PATTERN = _re.compile(
    r"\b(original|germ protection|daily protection|premium|regular|medium|"
    r"antibiotic residue[- ]free|strong teeth|anticavity|amino shakti|"
    r"saver pack|multi\s*pack|value pack|combo|table tray|farm|fresho|"
    r"loose|hybrid|local|natural care|rich & flavourful|rich & aromatic|"
    r"front load|top load|black gel|bamboo charcoal|sensitive soft bristles|"
    r"pure detox|anti[- ]pollution|purity|valencia|skincare)\b",
    _re.IGNORECASE,
)


def _base_product_name(name: str) -> str:
    """Strip size/quantity and variant descriptors to get the core product identity."""
    # Remove size info
    base = _SIZE_PATTERN.sub("", name).strip()
    # Remove variant descriptors
    base = _VARIANT_PATTERN.sub("", base).strip()
    # Collapse multiple spaces/dashes/commas
    base = _re.sub(r"[\s,\-]+", " ", base).strip().rstrip("-,").strip()
    # Take only the first few meaningful words (max 3) to group aggressively
    words = [w for w in base.split() if len(w) > 1]
    return " ".join(words[:3]).lower() if words else name.lower()


def _select_diverse_products(matched: List[dict], limit: int = 6, category_key: str = "") -> List[dict]:
    """Pick one representative product per unique base name, prioritizing staples."""
    from collections import OrderedDict

    # Category-specific priority keywords
    _PRIORITY_MAP: dict[str, List[str]] = {
        "produce": ["beans", "brinjal", "bitter gourd", "tomato", "potato", "carrot", "onion"],
        "household": ["liquid handwash", "antiseptic disinfectant", "bathing soap - cool", "charcoal clean toothpaste", "bathing soap", "toothpaste", "detergent"],
    }
    # Default fallback
    _DEFAULT_PRIORITY = ["toothpaste", "soap", "disinfectant", "detergent", "shampoo", "cleaner"]

    priority_keywords = _PRIORITY_MAP.get(category_key, _DEFAULT_PRIORITY)

    groups: OrderedDict[str, List[dict]] = OrderedDict()
    for p in matched:
        base = _base_product_name(p["name"])
        if base not in groups:
            groups[base] = []
        groups[base].append(p)

    # Pick one representative per group (mid-price variant)
    candidates: List[dict] = []
    for _base, variants in groups.items():
        variants_sorted = sorted(variants, key=lambda x: x["price"])
        mid_idx = len(variants_sorted) // 2
        candidates.append(variants_sorted[mid_idx])

    # Sort by priority: staple keywords first, then by name
    def _priority_score(product: dict) -> int:
        name_lower = product["name"].lower()
        for i, kw in enumerate(priority_keywords):
            if kw in name_lower:
                return i
        return len(priority_keywords) + 1

    candidates.sort(key=lambda p: (_priority_score(p), p["name"]))

    return candidates[:limit]


@router.get("/restock/{category}", response_model=CartResponse)
def get_restock(category: str):
    key = category.lower()
    target_category = RESTOCK_CATEGORY_MAP.get(key)

    if target_category:
        matched = [p for p in PRODUCTS if p.get("category") == target_category]
    else:
        matched = [
            p
            for p in PRODUCTS
            if key in str(p.get("category", "")).lower()
        ]

    if not matched:
        matched = PRODUCTS[:6]

    # Select diverse products (deduplicated by base product name)
    selected = _select_diverse_products(matched, limit=6, category_key=key)

    items: List[Product] = [
        Product(id=p["id"], name=p["name"], price=p["price"], image_url=p["image_url"]) for p in selected
    ]

    total = sum(i.price for i in items)
    return CartResponse(items=items, total_cost=round(total, 2))


# ---------------------------------------------------------------------------
# Intent — RAG pipeline (Retrieve → Generate)
# ---------------------------------------------------------------------------

def _extract_json_payload(raw_text: str) -> dict:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.removeprefix("```json").removeprefix("```").strip()
        if text.endswith("```"):
            text = text[:-3].strip()

    return json.loads(text)


@router.post("/intent", response_model=IntentResponse)
def create_intent_bundle(payload: IntentRequest):
    # Step 1: Retrieval — embed query and find top 40 relevant items
    try:
        retrieved_items = _retrieve_top_k(payload.query, top_k=40)
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail=f"RAG retrieval step failed: {exc}",
        ) from exc

    # Step 2: Generation — pass only the retrieved subset to Gemini with multi-tier instructions
    client = _get_genai_client()

    system_instruction = (
        "You are an expert retail merchandiser. We have a store promotion: if a user spends ₹1000, "
        "they get ₹100 off. Your goal is to fulfill the user's intent by curating UP TO 3 distinct "
        "price-tier bundles from the provided catalog items:\n\n"
        "1. 'Smart Saver' — the most affordable combination that fulfills the intent, targeting ₹1000-₹1150 total.\n"
        "2. 'Popular Choice' — a balanced mid-range selection, targeting ₹1000-₹1300 total.\n"
        "3. 'Premium Selection' — the highest quality/premium items, targeting ₹1200-₹1500 total.\n\n"
        "RULES:\n"
        "- Each bundle must fulfill the same user intent with relevant items.\n"
        "- Each bundle should cross the ₹1000 threshold so the user unlocks the discount.\n"
        "- If the catalog doesn't have enough variety to create 3 distinct tiers, return 2 or even 1.\n"
        "- Do NOT pad bundles with irrelevant items just to hit a price target.\n"
        "- Additionally, select 6-10 relevant items that did NOT make any bundle and return them in extras.\n"
        "- Return strictly formatted JSON matching the schema below."
    )

    prompt = (
        f"User intent: {payload.query}\n\n"
        f"Relevant catalog items (pre-filtered for relevance): {json.dumps(retrieved_items, ensure_ascii=False)}\n\n"
        "Return a JSON object with exactly these keys: bundles, extras.\n"
        "bundles must be an array of 1-3 objects, each with: name (string), items (array of product objects with id, name, price, image_url), total_cost (number = sum of item prices in that bundle).\n"
        "extras must be an array of 6-10 product objects with id, name, price, and image_url.\n"
        "Bundle names must be exactly one of: 'Smart Saver', 'Popular Choice', 'Premium Selection'."
    )

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                systemInstruction=system_instruction,
                responseMimeType="application/json",
            ),
        )
        if not getattr(response, "text", None):
            raise ValueError("Empty response from Gemini")

        result = _extract_json_payload(response.text)
        return IntentResponse.model_validate(result)
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Gemini generation step failed: {exc}") from exc
