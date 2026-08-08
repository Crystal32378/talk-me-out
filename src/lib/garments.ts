import type { Garment, GarmentCategory } from "./types";

/**
 * Crystal's Closet — six default garments for the final YouCam hackathon
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
    id: "black-structured-dress",
    name: "Black Structured Dress",
    price: 0,
    currency: "USD",
    material: "Structured woven fabric; notched lapel, puff sleeve, side-tie",
    care: "Dry clean recommended. Steam to refresh.",
    type: "Dress",
    category: "false-investment",
    categoryLabel: GARMENT_CATEGORIES["false-investment"].label,
    purchaseTension: GARMENT_CATEGORIES["false-investment"].tension,
    imageUrl: "/garments/black-structured-dress.jpg",
    roastLines: [
      "Calling a black dress 'timeless' does not mean it will get worn.",
      "Structure adds presence. It also adds dry-cleaning.",
    ],
    isDefault: true,
  },
  {
    id: "vintage-beige-trench",
    name: "Vintage Beige Trench Coat",
    price: 0,
    currency: "USD",
    material: "Cotton-twill trench; notched lapel, belted waist, long sleeve",
    care: "Dry clean only. Air out between wears. Store on a wide hanger.",
    type: "Outerwear",
    category: "false-investment",
    categoryLabel: GARMENT_CATEGORIES["false-investment"].label,
    purchaseTension: GARMENT_CATEGORIES["false-investment"].tension,
    imageUrl: "/garments/vintage-beige-trench.jpg",
    roastLines: [
      "A trench coat is the most photographed coat you will own and the most forgotten.",
      "Vintage means character — and a dry-cleaning relationship.",
    ],
    isDefault: true,
  },
];

export function getGarmentById(id: string): Garment | undefined {
  return DEFAULT_GARMENTS.find((g) => g.id === id);
}
