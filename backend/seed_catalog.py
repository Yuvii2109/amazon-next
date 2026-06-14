"""Generate a large mock grocery catalog for Gemini intent testing.

Running this script writes `mock_db.py` in the same directory with:
- `mock_items`: the generated list of product dictionaries
- `PRODUCTS`: a compatibility alias for the existing backend code
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Iterable


CATEGORY_IMAGES = {
    "Fresh Produce": "https://images.unsplash.com/photo-1610348725531-843dff103e2c?w=400&q=80",
    "Dairy & Eggs": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80",
    "Bakery": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
    "Pantry Staples": "https://images.unsplash.com/photo-1506084868230-bb459c51a7b4?w=400&q=80",
    "Snacks & Sweets": "https://images.unsplash.com/photo-1621939514643-e1fc272ea73b?w=400&q=80",
    "Beverages": "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80",
    "Household Essentials": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80",
    "Personal Care": "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80",
}

TARGET_PER_CATEGORY = 38

CATEGORY_BLUEPRINTS = {
    "Fresh Produce": {
        "price_range": (25, 499),
        "families": [
            ("Organic Bananas", ["Bunch", "1kg Pack", "Family Pack", "Smoothie Pack"]),
            ("Baby Spinach", ["200g Pack", "500g Pack", "Washed & Ready Pack", "Salad Mix Pack"]),
            ("Hass Avocados", ["2 pcs", "4 pcs", "6 pcs", "Ripe-to-Eat Pack"]),
            ("Vine Tomatoes", ["500g Pack", "1kg Pack", "Cherry 250g", "Salad Pack"]),
            ("Red Onions", ["500g Pack", "1kg Pack", "2kg Pack", "Cooking Pack"]),
            ("Russet Potatoes", ["1kg Pack", "2kg Pack", "5kg Sack", "Baking Pack"]),
            ("Lemons", ["6 pcs", "12 pcs", "Juicing Pack", "Zesty Pack"]),
            ("Broccoli", ["1 Head", "2 Heads", "Florets Pack", "Steam Pack"]),
            ("Strawberries", ["250g Pack", "500g Pack", "Family Pack", "Dessert Pack"]),
            ("Cucumbers", ["2 pcs", "4 pcs", "Salad Pack", "Snacking Pack"]),
        ],
    },
    "Dairy & Eggs": {
        "price_range": (35, 699),
        "families": [
            ("Whole Milk", ["500ml", "1L", "2L", "Toned Milk 1L"]),
            ("Greek Yogurt", ["200g Tub", "500g Tub", "Family Tub", "Strawberry Greek Yogurt"]),
            ("Cheddar Cheese", ["200g Block", "500g Block", "Slices Pack", "Grated Cheese"]),
            ("Butter", ["100g", "200g", "Unsalted Butter", "Salted Butter"]),
            ("Eggs", ["6 pcs", "12 pcs", "Brown Eggs 12", "Free-Range Eggs 6"]),
            ("Paneer", ["200g Pack", "500g Pack", "Cottage Cheese", "Grill Pack"]),
            ("Curd", ["400g Cup", "1kg Tub", "Set Curd", "Hang Curd"]),
            ("Cream", ["200ml", "500ml", "Cooking Cream", "Whipping Cream"]),
            ("Buttermilk", ["1L", "6-Pack", "Salted Buttermilk", "Spiced Buttermilk"]),
            ("Mozzarella", ["200g Pack", "500g Pack", "Shredded Mozzarella", "Pizza Block"]),
        ],
    },
    "Bakery": {
        "price_range": (20, 399),
        "families": [
            ("Whole Wheat Bread", ["Loaf", "Sandwich Loaf", "Multigrain Loaf", "Sourdough Loaf"]),
            ("Burger Buns", ["4-Pack", "6-Pack", "Brioche Buns", "Seeded Buns"]),
            ("Croissants", ["2-Pack", "4-Pack", "Butter Croissants", "Almond Croissants"]),
            ("Muffins", ["Chocolate Muffin", "Blueberry Muffin", "Bran Muffin", "Banana Muffin"]),
            ("Bagels", ["Plain Bagels", "Sesame Bagels", "Everything Bagels", "Cinnamon Raisin Bagels"]),
            ("Dinner Rolls", ["6-Pack", "12-Pack", "Soft Rolls", "Milk Rolls"]),
            ("Tortillas", ["6-Pack", "12-Pack", "Whole Wheat Tortillas", "Corn Tortillas"]),
            ("Donuts", ["Glazed Donuts", "Chocolate Donuts", "Jelly Donuts", "Assorted Donuts"]),
            ("Cake Rusk", ["200g Pack", "500g Pack", "Cardamom Cake Rusk", "Plain Cake Rusk"]),
            ("Cookies", ["Oatmeal Cookies", "Butter Cookies", "Chocolate Chip Cookies", "Digestive Cookies"]),
        ],
    },
    "Pantry Staples": {
        "price_range": (35, 899),
        "families": [
            ("Basmati Rice", ["1kg Bag", "5kg Bag", "Premium Basmati", "Steam Basmati"]),
            ("Atta Flour", ["1kg Pack", "5kg Bag", "Whole Wheat Atta", "Multigrain Atta"]),
            ("Cooking Oil", ["500ml", "1L", "2L", "Refined Oil"]),
            ("Masoor Dal", ["500g Pack", "1kg Pack", "Split Masoor", "Organic Masoor"]),
            ("Pasta", ["Penne", "Spaghetti", "Macaroni", "Fusilli"]),
            ("Sauces", ["Tomato Sauce", "Pasta Sauce", "Chilli Sauce", "Soy Sauce"]),
            ("Canned Beans", ["Chickpeas", "Kidney Beans", "Black Beans", "Mixed Beans"]),
            ("Oats", ["Instant Oats", "Rolled Oats", "Steel Cut Oats", "Granola"]),
            ("Nut Butter", ["Peanut Butter", "Almond Butter", "Mixed Nut Butter", "Honey Nut Spread"]),
            ("Salt", ["Iodized Salt", "Pink Salt", "Black Salt", "Rock Salt"]),
        ],
    },
    "Snacks & Sweets": {
        "price_range": (20, 599),
        "families": [
            ("Potato Chips", ["Classic Salted", "Masala Chips", "Barbecue Chips", "Family Pack"]),
            ("Chocolate Bars", ["Dark Chocolate", "Milk Chocolate", "White Chocolate", "Hazelnut Chocolate"]),
            ("Trail Mix", ["Classic Mix", "Roasted Nuts Mix", "Party Mix", "Energy Mix"]),
            ("Granola Bars", ["Oats & Honey", "Protein Bar", "Fruit & Nut Bar", "Cranberry Bar"]),
            ("Cookies", ["Butter Cookies", "Chocolate Chip Cookies", "Oat Cookies", "Digestive Cookies"]),
            ("Candies", ["Gummies", "Lollipops", "Hard Candy", "Sour Candy"]),
            ("Popcorn", ["Butter Popcorn", "Caramel Popcorn", "Kettle Corn", "Movie Night Pack"]),
            ("Wafer Rolls", ["Chocolate Wafer Rolls", "Vanilla Wafer Rolls", "Cream Filled Rolls", "Crispy Rolls"]),
            ("Marshmallows", ["Mini Marshmallows", "Vanilla Marshmallows", "Chocolate Dipped", "Large Marshmallows"]),
            ("Savory Mix", ["Pretzels", "Crackers", "Cheese Crackers", "Sweet & Salty Mix"]),
        ],
    },
    "Beverages": {
        "price_range": (30, 799),
        "families": [
            ("Coffee", ["Whole Bean Dark Roast", "Instant Coffee", "Cold Brew", "Espresso Capsules"]),
            ("Tea", ["Black Tea", "Green Tea", "Herbal Tea", "Masala Tea"]),
            ("Fruit Juice", ["Orange Juice", "Apple Juice", "Mixed Fruit Juice", "Pomegranate Juice"]),
            ("Water", ["Sparkling Water", "Mineral Water", "Flavored Water", "Coconut Water"]),
            ("Soft Drinks", ["Cola", "Lemon Soda", "Ginger Ale", "Tonic Water"]),
            ("Hot Chocolate", ["Mix", "Drinking Chocolate", "Mocha Mix", "Cappuccino Mix"]),
            ("Protein Shake", ["Chocolate Shake", "Vanilla Shake", "Banana Shake", "Meal Shake"]),
            ("Electrolyte Drink", ["Sports Drink", "Energy Drink", "Recovery Drink", "Hydration Mix"]),
            ("Plant Milk", ["Almond Milk", "Oat Milk", "Soy Milk", "Dairy-Free Creamer"]),
            ("Iced Tea", ["Lemon Iced Tea", "Peach Iced Tea", "Berry Iced Tea", "Green Iced Tea"]),
        ],
    },
    "Household Essentials": {
        "price_range": (45, 999),
        "families": [
            ("Dishwashing Liquid", ["500ml", "Refill Pack", "Lemon Fresh", "Ultra Clean"]),
            ("Laundry Detergent", ["1kg", "Liquid Detergent", "Detergent Pods", "Fabric Softener"]),
            ("All-Purpose Cleaner", ["500ml", "1L", "Glass Cleaner", "Bathroom Cleaner"]),
            ("Garbage Bags", ["Small Pack", "Kitchen Bags", "Compost Bags", "Drawstring Bags"]),
            ("Toilet Tissue", ["4 Rolls", "12 Rolls", "Kitchen Towels", "Paper Napkins"]),
            ("Disinfectant Spray", ["Surface Sanitizer", "Hand Sanitizer", "Sanitizing Wipes", "Multi-Surface Spray"]),
            ("Air Freshener", ["Room Spray", "Bathroom Freshener", "Car Freshener", "Citrus Freshener"]),
            ("Bleach", ["Stain Remover", "Pre-Soak", "Color Safe Bleach", "Whitening Solution"]),
            ("Cleaning Tools", ["Mop Refill", "Microfiber Cloth", "Cleaning Brush", "Dustpan Set"]),
            ("Storage Wraps", ["Aluminum Foil", "Cling Film", "Baking Paper", "Storage Wrap"]),
        ],
    },
    "Personal Care": {
        "price_range": (49, 899),
        "families": [
            ("Body Wash", ["Shower Gel", "Bath Soap", "Luxury Soap", "Foaming Wash"]),
            ("Shampoo", ["Anti-Dandruff Shampoo", "Volume Shampoo", "Sulfate-Free Shampoo", "Daily Care Shampoo"]),
            ("Conditioner", ["Hair Mask", "Leave-In Conditioner", "Keratin Conditioner", "Repair Conditioner"]),
            ("Toothpaste", ["Whitening Toothpaste", "Sensitivity Paste", "Herbal Paste", "Fresh Mint"]),
            ("Toothbrush", ["Soft Toothbrush", "Medium Toothbrush", "Electric Brush Head", "Travel Toothbrush"]),
            ("Face Wash", ["Acne Face Wash", "Charcoal Face Wash", "Gentle Cleanser", "Oil Control Face Wash"]),
            ("Moisturizer", ["Face Cream", "Night Cream", "Gel Moisturizer", "Day Lotion"]),
            ("Sunscreen", ["SPF 30", "SPF 50", "Matte Sunscreen", "Hydrating Sunscreen"]),
            ("Deodorant", ["Roll-On", "Body Mist", "Antiperspirant", "Fresh Spray"]),
            ("Shaving Care", ["Razor Blades", "Shaving Cream", "Aftershave", "Trimmer Oil"]),
        ],
    },
}


def _rand_price(rng: random.Random, low: int, high: int) -> float:
    return round(rng.uniform(low, high), 2)


def _iter_names(families: Iterable[tuple[str, list[str]]]) -> Iterable[str]:
    for stem, variants in families:
        for variant in variants:
            yield f"{stem} ({variant})"


def generate_mock_items() -> list[dict[str, object]]:
    rng = random.Random(42)
    mock_items: list[dict[str, object]] = []
    next_id = 1

    for category, blueprint in CATEGORY_BLUEPRINTS.items():
        low, high = blueprint["price_range"]
        image_url = CATEGORY_IMAGES[category]
        names = list(_iter_names(blueprint["families"]))[:TARGET_PER_CATEGORY]

        for name in names:
            mock_items.append(
                {
                    "id": f"prod_{next_id:03d}",
                    "name": name,
                    "price": _rand_price(rng, low, high),
                    "image_url": image_url,
                    "category": category,
                }
            )
            next_id += 1

    return mock_items


def write_mock_db(output_path: Path) -> list[dict[str, object]]:
    mock_items = generate_mock_items()
    file_contents = "\n".join(
        [
            '"""Auto-generated mock catalog for the FastAPI backend.\n\nRun backend/seed_catalog.py to regenerate this file.\n"""',
            "",
            f"mock_items = {json.dumps(mock_items, indent=2, ensure_ascii=False)}",
            "",
            "PRODUCTS = mock_items",
            "",
        ]
    )
    output_path.write_text(file_contents, encoding="utf-8")
    return mock_items


def main() -> None:
    output_path = Path(__file__).with_name("mock_db.py")
    mock_items = write_mock_db(output_path)
    print(f"Wrote {len(mock_items)} items to {output_path}")


if __name__ == "__main__":
    main()
