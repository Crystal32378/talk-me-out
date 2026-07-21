import type { Garment, GarmentCategory } from "./types";

/**
 * Six default garments covering the distinct purchase-risk categories
 * defined in the product brief.
 *
 * Each garment ships with: name, price, material, care instructions,
 * garment type, clean product image, and two roast lines tied to its
 * purchase-risk category.
 *
 * Images are SVG-rendered silhouettes on a clean white background so the
 * MVP can run without external assets. They can be swapped for real
 * product photos before the final YouCam API demonstration.
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

export const DEFAULT_GARMENTS: Garment[] = [
  {
    id: "sequin-party-dress",
    name: "Midnight Sequin Mini Dress",
    price: 248,
    currency: "USD",
    material: "95% Polyester, 5% Spandex; sequin overlay",
    care: "Hand wash cold inside out. Lay flat to dry. Do not iron sequins.",
    type: "Dress",
    category: "unclear-occasion",
    categoryLabel: GARMENT_CATEGORIES["unclear-occasion"].label,
    purchaseTension: GARMENT_CATEGORIES["unclear-occasion"].tension,
    imageUrl: "/garments/sequin-dress.jpg",
    roastLines: [
      "Owning a sequin dress is not the same as having somewhere to wear it.",
      "Your closet already has one of these waiting for an invitation that never arrives.",
    ],
    isDefault: true,
  },
  {
    id: "minimal-beige-coat",
    name: "Architectural Beige Wool Coat",
    price: 890,
    currency: "USD",
    material: "70% Virgin wool, 30% Cashmere; cupro lining",
    care: "Dry clean only. Store on a padded hanger. Air out between wears.",
    type: "Outerwear",
    category: "false-investment",
    categoryLabel: GARMENT_CATEGORIES["false-investment"].label,
    purchaseTension: GARMENT_CATEGORIES["false-investment"].tension,
    imageUrl: "/garments/beige-coat.jpg",
    roastLines: [
      "Calling it an 'investment piece' does not make it appreciate in value.",
      "A coat at this price should outlive three trends and at least one apartment.",
    ],
    isDefault: true,
  },
  {
    id: "running-jacket",
    name: "Pro Trail Running Jacket",
    price: 320,
    currency: "USD",
    material: "Recycled nylon ripstop with DWR finish",
    care: "Machine wash cold, no fabric softener. Tumble dry low. Reapply DWR annually.",
    type: "Outerwear",
    category: "aspirational-identity",
    categoryLabel: GARMENT_CATEGORIES["aspirational-identity"].label,
    purchaseTension: GARMENT_CATEGORIES["aspirational-identity"].tension,
    imageUrl: "/garments/running-jacket.jpg",
    roastLines: [
      "Buying the jacket does not install the habit of running.",
      "Aspirational outerwear has funded more gyms than it has visited.",
    ],
    isDefault: true,
  },
  {
    id: "designer-collab-tee",
    name: "Designer Collaboration Logo Tee",
    price: 195,
    currency: "USD",
    material: "100% organic combed cotton, 240 GSM",
    care: "Machine wash cold inside out. Tumble dry low. Do not bleach print.",
    type: "Top",
    category: "brand-premium",
    categoryLabel: GARMENT_CATEGORIES["brand-premium"].label,
    purchaseTension: GARMENT_CATEGORIES["brand-premium"].tension,
    imageUrl: "/garments/designer-tee.jpg",
    roastLines: [
      "You are wearing a press release.",
      "A logo is not a personality, even at this price.",
    ],
    isDefault: true,
  },
  {
    id: "interview-blazer",
    name: "Crisp Charcoal Interview Blazer",
    price: 285,
    currency: "USD",
    material: "Italian stretch wool blend; viscose lining",
    care: "Dry clean only. Steam to refresh. Store with shoulders supported.",
    type: "Outerwear",
    category: "one-time-scenario",
    categoryLabel: GARMENT_CATEGORIES["one-time-scenario"].label,
    purchaseTension: GARMENT_CATEGORIES["one-time-scenario"].tension,
    imageUrl: "/garments/blazer.jpg",
    roastLines: [
      "The interview is one day. The blazer is forever — in the back of your closet.",
      "Buying confidence for a single morning is a bold pricing strategy.",
    ],
    isDefault: true,
  },
  {
    id: "cashmere-wrap",
    name: "Featherweight Cashmere Wrap",
    price: 410,
    currency: "USD",
    material: "100% Grade-A Mongolian cashmere, 2-ply",
    care: "Hand wash with cashmere shampoo or dry clean. Fold, do not hang.",
    type: "Outerwear",
    category: "high-maintenance",
    categoryLabel: GARMENT_CATEGORIES["high-maintenance"].label,
    purchaseTension: GARMENT_CATEGORIES["high-maintenance"].tension,
    imageUrl: "/garments/cashmere-wrap.jpg",
    roastLines: [
      "You like the photograph. You have not yet agreed to the maintenance contract.",
      "Cashmere asks for patience, soap, and storage you do not currently own.",
    ],
    isDefault: true,
  },
];

export function getGarmentById(id: string): Garment | undefined {
  return DEFAULT_GARMENTS.find((g) => g.id === id);
}
