import type { QuestionId, VerdictId } from "./types";

/**
 * Approved English copy library.
 *
 * Three layers (per the brief):
 *   1. Garment-specific observations (stored on each Garment)
 *   2. Answer-triggered evidence lines (defined here)
 *   3. Verdict closing lines (defined here, attached to the VerdictDefinition)
 *
 * Tone: witty, skeptical, direct. Never cruel.
 * Red lines: never critique the user's body, shape, size, age, skin color,
 * attractiveness, disability, gender expression, or any visible physical feature.
 */

type AnswerTrigger = {
  questionId: QuestionId;
  optionIds: string[];
  lines: string[];
};

export const ANSWER_TRIGGERED_LINES: AnswerTrigger[] = [
  {
    questionId: "occasion",
    optionIds: ["cannot-name", "this-month"],
    lines: [
      "If you cannot name where you would wear it, you may already have your answer.",
      "A garment without an occasion is just storage with better lighting.",
      "You are shopping for an imaginary calendar.",
    ],
  },
  {
    questionId: "duplication",
    optionIds: ["one", "two-plus"],
    lines: [
      "The similar item already in your closet would like to enter the conversation.",
      "A third version is not a new personal style. It is evidence.",
    ],
  },
  {
    questionId: "budget",
    optionIds: ["more-than-planned", "over-but-want"],
    lines: [
      "Your budget is not a suggestion.",
      "If the sentence begins with 'It is over budget, but…', the ending is rarely surprising.",
      "At this price, it should either last for years or help pay the rent.",
    ],
  },
  {
    questionId: "care",
    optionIds: ["did-not-check"],
    lines: [
      "Ignoring the care label does not make it disappear.",
      "Every 'probably fine in the washing machine' has a victim.",
    ],
  },
  {
    questionId: "care",
    optionIds: ["dry-clean"],
    lines: [
      "Dry cleaning is a subscription plan for clothing.",
      "You are buying the garment and an ongoing invoice.",
    ],
  },
  {
    questionId: "regret",
    optionIds: ["little-guilty", "seriously-regret"],
    lines: [
      "Your future regret has already submitted written testimony.",
      "Save this feeling. It is more useful than a discount code.",
      "You already know how this story ends.",
    ],
  },
];

export const VERDICT_CLOSING_LINES: Record<VerdictId, string[]> = {
  BUY_IT: [
    "This is rare. Do not waste it by buying it twice.",
  ],
  TRY_IN_STORE: [
    "A generated image flatters everyone. A real mirror does not.",
  ],
  BORROW_OR_RENT: [
    "You may want the memory of wearing this more than the responsibility of owning it.",
  ],
  WALK_AWAY: [
    "This is not rejection. It is financial self-respect.",
    "Leaving this page may be the best purchase decision you make today.",
    "Sometimes the best way to wear something is not to own it.",
  ],
};

export const CONSTRUCTIVE_NOTES: Record<VerdictId, string> = {
  BUY_IT:
    "Honestly, this purchase fits your real life. Buy it, wear it, and do not turn it into closet decoration.",
  TRY_IN_STORE:
    "Honestly, the idea may be right, but a generated image cannot answer questions about fit, comfort, or fabric. Try it in person before deciding.",
  BORROW_OR_RENT:
    "Honestly, you may want the memory of wearing this more than the responsibility of owning it.",
  WALK_AWAY:
    "Honestly, walking away is not a loss. It leaves your money available for something you genuinely need.",
};

export const EVIDENCE_RATIONALE: Record<QuestionId, Record<string, string>> = {
  occasion: {
    specific: "You have a real, named occasion. The garment has a job.",
    "this-month": "A vague 'sometime this month' tends to become 'someday'.",
    "cannot-name": "No named occasion is the strongest impulse signal in this flow.",
  },
  duplication: {
    no: "You do not already own a substitute — this fills an actual gap.",
    one: "One similar item is borderline; the second makes the purchase redundant.",
    "two-plus": "Two or more similar items means this is collection behavior, not need.",
  },
  budget: {
    within: "The price sits comfortably inside what you can spend.",
    reasonable: "The price is justifiable against the value you expect.",
    "more-than-planned": "Pushing past your plan is a recurring impulse pattern.",
    "over-but-want": "'Over budget, but I still want it' is the textbook impulse sentence.",
  },
  care: {
    machine: "Care requirements fit a normal laundry routine.",
    "hand-wash": "Hand-washing is a small ongoing tax you have agreed to pay.",
    "dry-clean": "Dry-cleaning adds a recurring cost on top of the purchase price.",
    "did-not-check": "Not checking the care label is a planning failure, not a feature.",
  },
  regret: {
    considered: "You have already accounted for the worst case — that is maturity.",
    "little-guilty": "Anticipated guilt is a signal worth listening to.",
    "seriously-regret": "Predicting serious regret is the clearest possible exit sign.",
  },
};

export const UI_COPY = {
  brand: {
    name: "Talk Me Out of It",
    tagline: "Your brutally honest fitting-room friend.",
    workingTitle: "退堂鼓",
  },
  intro: {
    kicker: "Persistent fitting room · anti-impulse mode",
    title: "Upload once. Try many.\nDecide what is worth trying for real.",
    body: "Most virtual try-on tools are designed to help you check out faster. This one is not. Upload one fitting photo, try as many garments as you want — Crystal's Closet or your own — and every look is saved on this device so you can come back, compare, and decide what actually deserves a real fitting room.",
    privacy: "Your fitting photo and saved results are stored on this device. New try-ons send the selected photo and garment to YouCam for processing. Talk Me Out of It keeps no account or cloud history. Clear local data anytime.",
    primaryCta: "Begin the interrogation",
    secondaryCta: "How this works",
    stepsLabel: "The flow",
    steps: [
      { n: 1, label: "Upload once" },
      { n: 2, label: "Try many garments" },
      { n: 3, label: "Real YouCam VTO" },
      { n: 4, label: "Five honest questions" },
      { n: 5, label: "Worth trying in person?" },
    ],
  },
  photo: {
    heading: "Show us the evidence.",
    body: "Upload a clear photo. Full-body or half-body works best. It is saved on this device for next time and sent to YouCam only when you start a new try-on.",
    privacy:
      "Your fitting photo and saved results are stored on this device. New try-ons send the selected photo and garment to YouCam for processing. Talk Me Out of It keeps no account or cloud history. Clear local data anytime.",
    uploadCta: "Upload from device",
    cameraCta: "Take a photo",
    dragHint: "Drag and drop an image here",
    or: "or",
    retake: "Replace photo",
    continueCta: "Continue with this photo",
    back: "Back",
    photoGuideTitle: "Photo requirements",
    photoGuide: [
      "Half-body (waist-up) or full-body",
      "Standing, facing the camera",
      "Arms visible, away from sides",
      "Plain background, even lighting",
    ],
    headshotWarning:
      "Headshots (face-only) do not work. The try-on API needs to see your torso so it can place the garment on your body. A face-only photo will produce a broken result.",
    // Persisted-photo UX
    persistedHeading: "Your fitting photo",
    persistedHint: "Stored on this device · sent to YouCam only for a new try-on.",
    usePersistedCta: "Use this photo",
    changePersistedCta: "Change photo",
    replaceClearsFittingRoom:
      "Changing your fitting photo will permanently clear every saved look because those results belong to the current person. Continue?",
    error: {
      type: "Unsupported file type. Use JPG, PNG, or WebP.",
      size: "File is too large. Keep it under 10 MB.",
      capture: "Could not access camera. Check browser permissions.",
    },
  },
  garment: {
    heading: "Pick your suspect.",
    body: "Nine garments from the creator's pre-owned wardrobe cover the most common purchase-risk patterns. You can also upload your own.",
    defaultTab: "Lineup",
    customTab: "Upload your own",
    selectCta: "Select this garment",
    selected: "Selected",
    continueCta: "Continue with this garment",
    back: "Back",
    fittingRoomCta: "My Fitting Room",
    triedBadge: "Tried",
    custom: {
      imageCta: "Upload garment image",
      nameLabel: "Garment name",
      priceLabel: "Price (USD, optional)",
      careLabel: "Care method",
      typeLabel: "Garment type",
      typeOptions: ["Top", "Outerwear", "Dress", "Bottom", "Unsure"],
      materialLabel: "Material (optional)",
      submitCta: "Use this garment",
      errorRequired: "Image, name, and care method are required.",
    },
  },
  tryon: {
    heading: "Looks good? Not so fast.",
    body: "Virtual try-on shows a visual possibility. It does not guarantee fit, comfort, sizing, fabric behavior, or real-world appearance.",
    generating: "Generating try-on result…",
    progressSteps: [
      "Uploading person photo to YouCam…",
      "Uploading garment image to YouCam…",
      "Creating try-on task…",
      "Polling YouCam for result…",
      "Finalizing result…",
    ],
    demoBanner: "DEMO MODE — PRE-GENERATED RESULT",
    demoExplanation:
      "Your photos were not sent to YouCam. This is a pre-generated result from an earlier real YouCam API call, shown so you can still try the rest of the flow.",
    fallbackBanner: "TRY-ON UNAVAILABLE — SIDE-BY-SIDE PREVIEW",
    cachedBanner: "CACHED RESULT — FROM YOUR FITTING ROOM",
    cachedExplanation:
      "You have already tried this garment. Showing the saved result from your fitting room so YouCam is not called again.",
    continueCta: "Continue to the interrogation",
    retryCta: "Try again",
    back: "Back",
    personLabel: "Your photo",
    garmentLabel: "Garment",
    errors: {
      invalidPerson: "The person image could not be processed. Use a clear, well-lit photo.",
      invalidGarment: "The garment image does not meet the API requirements. Use a clean, single-garment product photo.",
      api: "The YouCam API returned an error. You can continue in side-by-side mode.",
      timeout: "The request timed out. You can retry or continue in side-by-side mode.",
      empty: "The API returned an empty response. You can retry or continue in side-by-side mode.",
    },
  },
  interrogation: {
    heading: "The shopping interrogation.",
    body: "Five honest questions. There is no right answer — only an honest one.",
    progressLabel: (n: number, total: number) => `Question ${n} of ${total}`,
    nextCta: "Next question",
    back: "Previous question",
    seeVerdict: "See your verdict",
  },
  verdict: {
    headingLabel: "Your verdict",
    scoreLabel: "Impulse score",
    caseLabel: "The garment in question",
    maxScoreLabel: "out of",
    whyHeading: "Why this verdict",
    roastHeading: "Two cents from the fitting room",
    noteHeading: "Honestly",
    evidenceBullet: (idx: number) => `${idx}.`,
    // Binary presentation-layer decision copy
    decisionHeading: "What this means",
    decisionTryIrlShort: "WORTH TRYING IN PERSON",
    decisionTryIrlLong: "Virtual try-on looks promising and your purchase reasoning holds up. The next honest step is a real fitting room — confirm fit, fabric, and comfort before buying.",
    decisionSkipShort: "SKIP IT",
    decisionSkipLong: "Even if the virtual try-on looks fine, your purchase reasoning is not strong enough to justify the next step. Leave it for now.",
    tryAnotherCta: "Try another",
    viewFittingRoomCta: "View my fitting room",
    restartCta: "Interrogate another purchase",
    copyCta: "Copy verdict",
    skipAnimationCta: "Skip animation",
    copied: "Verdict copied to clipboard",
    shareHeading: "Talk Me Out of It",
    shareTagline: "Your brutally honest fitting-room friend.",
    poweredBy: "Powered by YouCam Apparel Virtual Try-On",
  },
  fittingRoom: {
    heading: "My Fitting Room",
    body: "Every garment you have tried is saved here on this device. Compare looks, revisit decisions, and see what is actually worth trying in person.",
    looksSaved: (n: number) => `${n} ${n === 1 ? "look" : "looks"} saved`,
    progressLabel: (tried: number, total: number) => `${tried} of ${total} tried`,
    triedSection: "Tried",
    notTriedSection: "Not tried yet",
    tryThisCta: "Try this",
    viewDetailCta: "View",
    deleteLookCta: "Remove",
    clearAllCta: "Clear fitting room",
    clearAllConfirm: "This will permanently remove your saved fitting photo and every saved look on this device. This cannot be undone. Continue?",
    emptyState: "No looks saved yet. Try a garment to see it here.",
    backCta: "Back",
    backToGarmentCta: "Try another garment",
    privacyNote: "Your fitting photo and saved results are stored on this device. New try-ons send the selected photo and garment to YouCam for processing. Talk Me Out of It keeps no account or cloud history. Clear local data anytime.",
    decisionBadgeTryIrl: "TRY IN PERSON",
    decisionBadgeSkip: "SKIP",
  },
};
