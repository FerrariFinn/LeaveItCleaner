import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";
import type { Category } from "./supabase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export type NormalizedItem = { category_id: string; count: number; description: string };
export type NormalizedLog = { location: string; items: NormalizedItem[] };

/** AI layer 1: turn the surfer's free text into rows that fit the database. */
export async function normalizeLog(
  locationRaw: string,
  itemsRaw: string,
  categories: Category[]
): Promise<NormalizedLog> {
  const categoryList = categories.map((c) => `- ${c.id}: ${c.label}`).join("\n");

  const prompt = `You normalize beach cleanup logs from surfers in the West Algarve, Portugal.

Map the litter description onto these categories (use the id):
${categoryList}

Rules:
- Return one entry per distinct kind of item, with an integer count >= 1.
- For vague amounts estimate conservatively: "a few" = 3, "some" = 3, "a bunch"/"lots"/"loads" = 10, "a bag of X" = 15.
- Pieces of rope or net count as one item per piece/tangle.
- If nothing fits, use "other". Ignore anything that is not litter.
- "description" is a short English description of the item (max 6 words).
- "location": the beach or surf spot name, cleaned up and properly capitalized (e.g. "praia do amado" -> "Praia do Amado"). Keep it as the user meant it; do not invent a different place.
- Input may be in any language.

Location typed by the surfer: ${JSON.stringify(locationRaw)}
Litter typed by the surfer: ${JSON.stringify(itemsRaw)}`;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category_id: { type: Type.STRING, enum: categories.map((c) => c.id) },
                count: { type: Type.INTEGER },
                description: { type: Type.STRING },
              },
              required: ["category_id", "count", "description"],
            },
          },
        },
        required: ["location", "items"],
      },
    },
  });

  const parsed = JSON.parse(res.text ?? "{}") as NormalizedLog;
  const validIds = new Set(categories.map((c) => c.id));
  return {
    location: parsed.location?.trim() || locationRaw.trim(),
    items: (parsed.items ?? [])
      .map((i) => ({ ...i, count: Math.round(i.count), category_id: validIds.has(i.category_id) ? i.category_id : "other" }))
      .filter((i) => i.count > 0),
  };
}

export type MonthData = {
  month: string; // "2026-12"
  sessionCount: number;
  itemCount: number;
  surferCount: number;
  byCategory: { label: string; count: number }[];
  byLocation: { location: string; sessions: number; items: number }[];
  notableItems: string[];
};

/** AI layer 2: write the monthly "What we found" summary. */
export async function summarizeMonth(data: MonthData): Promise<string> {
  const prompt = `You write the monthly "What we found" summary for "Leave it cleaner", a community initiative where surfers in the West Algarve spend 10 minutes after each surf session picking up litter from the beach and log what they found.

Audience: surf camps, hostels, their guests and the local surf community. Later also cleanup organisations.

Write 150-250 words in English. Friendly, concrete and a little proud, but not preachy. Start with a short headline line. Mention the headline numbers, the most common items, which spots got the most attention, and anything notable. End with a short invitation to join (10 minutes on the sand, one scan). Use plain text, no markdown tables. Only use the numbers given below; do not invent data.

Data for ${data.month}:
${JSON.stringify(data, null, 2)}`;

  const res = await ai.models.generateContent({ model: MODEL, contents: prompt });
  return res.text?.trim() ?? "";
}
