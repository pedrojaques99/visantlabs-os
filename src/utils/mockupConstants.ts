// Mockup tag pools — source of truth para sugestões de tags em projetos de
// branding e identidade visual estratégica. Esses arrays são o FALLBACK usado
// quando o Mongo não tem presets seedados; quando tem, `tagService` sobrescreve
// com o que vier do DB. Pra manter os dois em sincronia rode:
//
//   npx tsx server/scripts/seedMockupPresets.ts
//
// Curadoria: preferir tokens curtos, específicos, que o modelo IA entende como
// direção de arte — evitar genéricos ("nice", "cool"). Cada tag é um fragmento
// de prompt que, combinado, forma um brief visual coerente.
//
// IMPORTANTE: `src/constants/mockupVibes.ts` valida via `pick()` que toda tag
// referenciada existe aqui. Renomear ou remover uma tag referenciada por uma
// vibe quebra o app no import — atualize os dois arquivos juntos.

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CATEGORIES — o "o quê" do mockup (stationery, apparel, packaging…)
// ─────────────────────────────────────────────────────────────────────────────
export const AVAILABLE_TAGS = [
    // Stationery & Brand Kit
    "Business Card", "Letterhead", "Envelope", "Compliment Slip",
    "Brand Manual Spread", "Trifold Brochure", "Notebook", "Hang Tag",
    "Book Cover", "Magazine Cover", "Menu Card",
    // Print & Display
    "Poster", "Flyer", "Billboard", "Signage", "Wall Art", "Framed Art",
    "Window Decal",
    // Packaging
    "Box Packaging", "Bag Packaging", "Pouch Packaging", "Shopping Bag",
    "Bottle Label", "Can Label",
    // Apparel & Merch
    "T-shirt", "Polo Shirt", "Hoodie", "Cap", "Hat", "Tote Bag", "Apron",
    "Enamel Pin",
    // Digital & Devices
    "Phone Screen", "Tablet Screen", "Laptop Screen", "Website UI",
    // Drinkware & Misc
    "Mug", "Cup", "Sticker", "Flag", "Vehicle Wrap",
];

// ─────────────────────────────────────────────────────────────────────────────
// BRANDING ARCHETYPES — posicionamento da marca (input estratégico)
// ─────────────────────────────────────────────────────────────────────────────
export const AVAILABLE_BRANDING_TAGS = [
    "Agriculture", "Artisanal", "Bold", "Casual", "Corporate", "Creative",
    "Crypto/Web3", "Eco-friendly", "Editorial", "Energetic", "Exclusive",
    "Fashion", "Feminine", "Food", "Friendly", "Futuristic", "Handmade",
    "Health & Wellness", "Heritage", "Industrial", "Kids & Baby", "Luxury",
    "Minimalist", "Modern", "Playful", "Premium", "Refined", "Sport",
    "Sustainable", "Tech", "Travel & Hospitality", "Vintage",
];

// ─────────────────────────────────────────────────────────────────────────────
// LOCATIONS / AMBIENCE — onde o produto vive
// ─────────────────────────────────────────────────────────────────────────────
export const AVAILABLE_LOCATION_TAGS = [
    // Studio / editorial
    "Minimalist Studio", "Seamless Paper Backdrop", "Cyclorama Studio",
    "Light Box", "Glass Environment",
    // Corporate / architecture
    "Modern Office", "Workspace", "Brutalist Concrete", "Glass Skyscraper Lobby",
    "Industrial Loft", "Urban Loft",
    // Lifestyle / home / warm
    "Warm Home Office", "Wooden Table", "Linen Tabletop",
    // Luxury / premium surfaces
    "Black Marble Slab", "Limestone Surfaces", "Travertine Surface",
    "Velvet Drape", "Dark Showroom",
    // Street / urban / gritty
    "Urban City", "Concrete", "Weathered Concrete Wall", "Painted Brick Alley",
    "Industrial Loading Dock",
    // Nature / outdoor
    "Nature landscape", "Wild Botanical Scene", "Forest Canopy", "Grass/Lawn",
    "Coastal Sand", "River Stones", "California Coast",
    // City references (vibe/culture)
    "Tokyo", "New York", "Paris", "London", "Nordic", "Brazil",
    // Retail
    "Boutique Shelf", "Café Counter",
];

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA ANGLES — enquadramento e perspectiva
// ─────────────────────────────────────────────────────────────────────────────
export const AVAILABLE_ANGLE_TAGS = [
    "Eye-Level", "Three-Quarter View", "45° Angle", "Side View", "Profile",
    "Low Angle", "Hero Angle", "Worm's-Eye View", "High Angle",
    "Top-Down (Flat Lay)", "Overhead Tabletop", "Knolling Layout",
    "Close-Up", "Detail Shot", "Macro 100mm",
    "Wide Shot", "Establishing Shot", "Dutch Angle", "Isometric View",
];

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTING — direção, dureza, temperatura
// ─────────────────────────────────────────────────────────────────────────────
export const AVAILABLE_LIGHTING_TAGS = [
    // Studio controlled
    "Studio Lighting", "Large Softbox Key", "Soft Light", "Diffused",
    "Rim Light", "Hard Rim Light", "Chiaroscuro", "Single Beam Spotlight",
    "Backlit Silhouette",
    // Natural
    "Natural Light", "North-Window Daylight", "Golden Hour", "Blue Hour",
    "Overcast", "Direct Sunlight", "Hard Sunlight", "Dappled Leaf Light",
    // Cinematic / mood
    "Cinematic", "Volumetric God Rays", "Night Scene", "Warm Practical Tungsten",
    "Neon Accent Glow", "Shadow overlay",
    // Technical
    "Global Illumination", "Caustic Lighting",
];

// ─────────────────────────────────────────────────────────────────────────────
// EFFECTS — grade de cor, grain, lens, pós
// ─────────────────────────────────────────────────────────────────────────────
export const AVAILABLE_EFFECT_TAGS = [
    // Depth & lens
    "Shallow Depth of Field", "Bokeh", "Motion Blur", "Long Exposure",
    "Fish-eye lens", "Subtle Lens Bloom",
    // Flares & grain
    "Lens Flare", "Anamorphic Flare", "Halation Glow", "35mm Film Grain",
    "Vintage Film",
    // Color grading
    "Teal & Amber Grade", "Warm Color Grade", "Monochrome", "High Contrast",
    "Halftone",
    // Render / fidelity
    "Ray-tracing", "Subsurface Scattering", "Micro-contrast", "8k Resolution",
    // Atmosphere
    "Atmospheric Haze",
];

// ─────────────────────────────────────────────────────────────────────────────
// MATERIALS / TEXTURES — acabamento e tatilidade (importante pra branding)
// ─────────────────────────────────────────────────────────────────────────────
export const AVAILABLE_MATERIAL_TAGS = [
    // Paper & print finishes (core branding)
    "Uncoated Cotton Paper", "Letterpress Cardstock", "Tactile Paper Grain",
    "Embossed", "Debossed", "Foil Stamp", "Recycled Kraft",
    "Soft-Touch Matte", "Glossy Lamination",
    // Glass & crystal
    "Frosted Glass", "Liquid Glass", "Cut Crystal", "Condensation Droplets",
    // Metals
    "Brushed Aluminum", "Anodized Titanium", "Polished Gold", "Liquid Chrome",
    "Metallic Platinum",
    // Technical / sport
    "Carbon Fiber Weave",
    // Textiles & organic
    "Raw Linen", "Silk Velvet", "Ceramic", "Ceramic Glaze", "Oak Wood Grain",
    "Black Marble",
    // Plastic
    "Soft-touch Plastic",
];

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC FALLBACKS — usados quando nenhum tag é selecionado
// ─────────────────────────────────────────────────────────────────────────────
export const GENERIC_MOCKUP_TAGS = [
    "Business Card",
    "Letterhead",
    "Brand Manual Spread",
    "Laptop Screen",
    "T-shirt",
    "Poster",
    "Hang Tag",
    "Signage",
    "Shopping Bag",
    "Notebook",
];

export const GENERIC_BRANDING_TAGS = [
    "Modern",
    "Minimalist",
    "Refined",
];
