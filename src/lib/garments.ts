import type { Garment, GarmentCategory } from "./types";

/**
 * Crystal's Closet — nine default garments for the final YouCam hackathon
 * submission.
 *
 * Sample garment photographs are original photos supplied by the project
 * creator from her personal pre-owned wardrobe. They are NOT retailer
 * products, are not currently for sale, and there is no brand partnership.
 * Brand labels visible in the original photos have been masked in the
 * copies committed to this repo; the creator's originals are not modified.
 *
 * Each garment entry ships with: descriptive name, garment type, a
 * purchase-risk category, an attribution tag, a clean product photo in
 * /public/garments/, and two roast lines tied to its purchase-risk
 * category. There are intentionally no prices — this is not a shop.
 */

export const GARMENT_CATEGORIES: Record<
  GarmentCategory,
  { label: string; tension: string }
> = {
  "unclear-occasion": {
    label: "Unclear occasion",
    tension: "Rarely worn",
  },
  "false-investment": {
    label: "False investment logic",
    tension: "Marketed as a 'classic investment'",
  },
  "aspirational-identity": {
    label: "Aspirational identity",
    tension: "Buying equipment instead of forming the habit",
  },
  "brand-premium": {
    label: "Brand premium",
    tension: "Paying mainly for branding",
  },
  "one-time-scenario": {
    label: "One-time scenario",
    tension: "Limited future use",
  },
  "high-maintenance": {
    label: "High maintenance",
    tension: "Ongoing care cost",
  },
};

/**
 * Attribution line shown in the UI. Lighter than the README's full
 * provenance sentence, but still honest about where the photos come from.
 */
export const GARMENT_COLLECTION_NAME = "Crystal’s Closet";
export const GARMENT_ATTRIBUTION_LINE = "From the creator’s pre-owned wardrobe";

export const DEFAULT_GARMENTS: Garment[] = [
  {
    id: "yellow-floral-dress",
    name: "Yellow Floral Dress",
    // Price intentionally omitted — this is not a shop.
    price: 0,
    currency: "USD",
    material: "Lightweight woven floral print; sleeveless cold-shoulder cut",
    care: "Machine wash cold, hang to dry.",
    type: "Dress",
    category: "unclear-occasion",
    categoryLabel: GARMENT_CATEGORIES["unclear-occasion"].label,
    purchaseTension: GARMENT_CATEGORIES["unclear-occasion"].tension,
    imageUrl: "/garments/yellow-floral-dress.jpg",
    roastLines: [
      "A floral dress without a named occasion tends to become closet wallpaper.",
      "Pretty is a feeling. An event is a reason.",
    ],
    isDefault: true,
  },
  {
    id: "black-white-check-dress",
    name: "Black & White Check Dress",
    price: 0,
    currency: "USD",
    material: "Cotton-blend gingham check; babydoll silhouette",
    care: "Machine wash cold inside out. Tumble dry low.",
    type: "Dress",
    category: "unclear-occasion",
    categoryLabel: GARMENT_CATEGORIES["unclear-occasion"].label,
    purchaseTension: GARMENT_CATEGORIES["unclear-occasion"].tension,
    imageUrl: "/garments/black-white-check-dress.jpg",
    roastLines: [
      "A check dress is a mood, not a plan.",
      "If you already own one like it, the closet has already voted.",
    ],
    isDefault: true,
  },
  {
    id: "lavender-maxi-dress",
    name: "Lavender Maxi Dress",
    price: 0,
    currency: "USD",
    material: "Soft woven tiered maxi; spaghetti straps, V-neck",
    care: "Hand wash or gentle cycle. Hang to dry.",
    type: "Dress",
    category: "one-time-scenario",
    categoryLabel: GARMENT_CATEGORIES["one-time-scenario"].label,
    purchaseTension: GARMENT_CATEGORIES["one-time-scenario"].tension,
    imageUrl: "/garments/lavender-maxi-dress.jpg",
    roastLines: [
      "A maxi dress for one event is a long-term storage commitment.",
      "Tiered fabric photographs beautifully and folds reluctantly.",
    ],
    isDefault: true,
  },
  {
    id: "black-white-lace-top",
    name: "Black & White Lace Top",
    price: 0,
    currency: "USD",
    material: "Cotton-blend lace overlay; crew neck, sleeveless",
    care: "Hand wash cold. Lay flat to dry. Do not wring.",
    type: "Top",
    category: "high-maintenance",
    categoryLabel: GARMENT_CATEGORIES["high-maintenance"].label,
    purchaseTension: GARMENT_CATEGORIES["high-maintenance"].tension,
    imageUrl: "/garments/black-white-lace-top.jpg",
    roastLines: [
      "Lace is a relationship. It asks for hand-washing and patience.",
      "The photograph loves it. Your laundry routine has not been consulted.",
    ],
    isDefault: true,
  },
  {
    id: "black-floral-wrap-maxi-dress",
    name: "Black Floral Wrap Maxi Dress",
    price: 0,
    currency: "USD",
    material: "Black woven with vibrant floral print; wrap bodice, short sleeve, V-neck",
    care: "Hand wash or gentle cycle. Hang to dry.",
    type: "Dress",
    category: "unclear-occasion",
    categoryLabel: GARMENT_CATEGORIES["unclear-occasion"].label,
    purchaseTension: GARMENT_CATEGORIES["unclear-occasion"].tension,
    imageUrl: "/garments/black-floral-wrap-maxi-dress.jpg",
    roastLines: [
      "A floral maxi is a story you tell yourself about a future event.",
      "Wrap silhouettes photograph well and untie in transit.",
    ],
    isDefault: true,
  },
  {
    id: "sage-utility-jacket",
    name: "Sage Utility Jacket",
    price: 0,
    currency: "USD",
    material: "Cotton-twill utility jacket; hood, button-over-zip front, chest + hip pockets",
    care: "Machine wash cold. Tumble dry low. Re-shape while damp.",
    type: "Outerwear",
    category: "aspirational-identity",
    categoryLabel: GARMENT_CATEGORIES["aspirational-identity"].label,
    purchaseTension: GARMENT_CATEGORIES["aspirational-identity"].tension,
    imageUrl: "/garments/sage-utility-jacket.jpg",
    roastLines: [
      "A utility jacket suggests an outdoor life you have not yet scheduled.",
      "Pockets are not a life plan, even when there are six of them.",
    ],
    isDefault: true,
  },
  {
    id: "red-short-sleeve-dress",
    name: "Red Short-Sleeve Dress",
    price: 0,
    currency: "USD",
    material: "Red woven with black trim; short sleeve, boat neck, ruched shoulder detail",
    care: "Machine wash cold inside out. Hang to dry.",
    type: "Dress",
    category: "one-time-scenario",
    categoryLabel: GARMENT_CATEGORIES["one-time-scenario"].label,
    purchaseTension: GARMENT_CATEGORIES["one-time-scenario"].tension,
    imageUrl: "/garments/red-short-sleeve-dress.jpg",
    roastLines: [
      "A red dress for one occasion is a long-term closet commitment.",
      "Black trim is detail. The price tag is the detail that matters.",
    ],
    isDefault: true,
  },
  {
    id: "beige-linen-feel-dress",
    name: "Beige Linen-Feel Dress",
    price: 0,
    currency: "USD",
    material: "Beige woven with linen-like hand; cap sleeve, round neck, button placket, hip pockets",
    care: "Machine wash cold. Hang to dry. Warm iron if needed.",
    type: "Dress",
    category: "unclear-occasion",
    categoryLabel: GARMENT_CATEGORIES["unclear-occasion"].label,
    purchaseTension: GARMENT_CATEGORIES["unclear-occasion"].tension,
    imageUrl: "/garments/beige-linen-feel-dress.jpg",
    roastLines: [
      "A beige dress is the most versatile thing you will never wear.",
      "Linen-feel wrinkles like real linen and forgives like polyester.",
    ],
    isDefault: true,
  },
  {
    id: "black-ruffle-mini-dress",
    name: "Black Ruffle Mini Dress",
    price: 0,
    currency: "USD",
    material: "Black woven with ruffled bib front and shoulder bow; sleeveless, high neck",
    care: "Hand wash cold. Lay flat to dry. Steam ruffles gently.",
    type: "Dress",
    category: "one-time-scenario",
    categoryLabel: GARMENT_CATEGORIES["one-time-scenario"].label,
    purchaseTension: GARMENT_CATEGORIES["one-time-scenario"].tension,
    imageUrl: "/garments/black-ruffle-mini-dress.jpg",
    roastLines: [
      "Ruffles and a bow is a costume for an event you cannot name.",
      "The mini dress photographs louder than it lives.",
    ],
    isDefault: true,
  },
];

export function getGarmentById(id: string): Garment | undefined {
  return DEFAULT_GARMENTS.find((g) => g.id === id);
}
