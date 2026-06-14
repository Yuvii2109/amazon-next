from pydantic import BaseModel
from typing import List


class Product(BaseModel):
    id: str
    name: str
    price: float
    image_url: str


class CartResponse(BaseModel):
    items: List[Product]
    total_cost: float
    extras: List[Product] = []


class TieredBundle(BaseModel):
    name: str
    items: List[Product]
    total_cost: float


class IntentResponse(BaseModel):
    bundles: List[TieredBundle]
    extras: List[Product] = []
