import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FASTAPI_URL = "http://127.0.0.1:8000";

async function parseBackendResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const errorBody = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    throw new Error(
      typeof errorBody === "string" && errorBody
        ? errorBody
        : typeof errorBody?.detail === "string"
          ? errorBody.detail
          : `FastAPI request failed with status ${response.status}`,
    );
  }

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return JSON.parse(text);
}

export const generateIntentCart = createServerFn({ method: "POST" })
  .inputValidator(z.string().min(1))
  .handler(async ({ data }) => {
    try {
      const response = await fetch(`${FASTAPI_URL}/api/intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: data }),
      });

      return await parseBackendResponse(response);
    } catch (error) {
      console.error("[generateIntentCart] Failed to request FastAPI intent endpoint:", error);
      throw new Error("Unable to generate a shopping cart right now.");
    }
  });

export const fetchSmartRestock = createServerFn({ method: "GET" })
  .inputValidator(z.string().min(1))
  .handler(async ({ data }) => {
    try {
      const response = await fetch(`${FASTAPI_URL}/api/restock/${encodeURIComponent(data)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      return await parseBackendResponse(response);
    } catch (error) {
      console.error("[fetchSmartRestock] Failed to request FastAPI restock endpoint:", error);
      throw new Error("Unable to load smart restock recommendations right now.");
    }
  });

export const searchProducts = createServerFn({ method: "GET" })
  .inputValidator(z.string().min(2))
  .handler(async ({ data }) => {
    try {
      const response = await fetch(
        `${FASTAPI_URL}/api/search?q=${encodeURIComponent(data)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      );

      return await parseBackendResponse(response);
    } catch (error) {
      console.error("[searchProducts] Failed to request FastAPI search endpoint:", error);
      throw new Error("Unable to search products right now.");
    }
  });
