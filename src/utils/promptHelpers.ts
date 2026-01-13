import { AVAILABLE_LOCATION_TAGS } from './mockupConstants';

// Gera descrição do ambiente baseado no background
export const getBackgroundDescription = (background: string): string => {
    const descriptions: Record<string, string> = {
        "Minimalist Studio": "The scene should be set in a professional photography studio with infinite white wall background, studio lighting, clean and minimalist aesthetic.",
        "Light Box": "The scene should be set in a professional lightbox photography environment with seamless white or neutral background, even diffused lighting, completely neutral and minimal aesthetic. This is a professional product photography setup with no decorative elements, plants, or distractions - purely focused on showcasing the product with clean, professional lighting.",
        "Grass/Lawn": "The scene should be set on a lush green grass lawn with natural outdoor lighting, creating a fresh and organic atmosphere.",
        "Concrete": "The scene should be set on a textured concrete surface with modern, industrial aesthetic and natural or studio lighting.",
        "Wooden Slat Wall": "The scene should be set against a wooden slat wall with warm, natural tones and ambient lighting that highlights the wood texture.",
        "Wooden Table": "The scene should be set on a wooden table surface with natural wood grain visible, creating a warm and rustic atmosphere.",
        "Glass Environment": "The scene should be set in a modern glass environment with transparent surfaces, reflections, and contemporary lighting.",
        "Modern Office": "The scene should be set in a modern office environment with contemporary furniture, clean lines, and professional lighting.",
        "Urban City": "The scene should be set in an urban city environment with architectural elements, street aesthetics, and dynamic lighting.",
        "Nature landscape": "The scene should be set in a natural landscape environment with organic elements, natural lighting, and outdoor atmosphere.",
        "Workspace": "The scene should be set in a creative workspace with modern design elements, functional aesthetics, and professional lighting.",
        "Tokyo": "The scene should be set in a Tokyo-inspired environment with modern Japanese aesthetics, urban elements, and contemporary lighting.",
        "New York": "The scene should be set in a New York-inspired environment with urban architecture, street culture, and dynamic lighting.",
        "Brazil": "The scene should be set in a Brazil-inspired environment with vibrant colors, tropical elements, and warm natural lighting.",
        "Paris": "The scene should be set in a Paris-inspired environment with elegant architecture, classic aesthetics, and sophisticated lighting.",
        "London": "The scene should be set in a London-inspired environment with British design elements, urban charm, and atmospheric lighting.",
        "Nordic": "The scene should be set in a Nordic-inspired environment with minimalist design, natural materials, and soft natural lighting.",
        "California Coast": "The scene should be set in a California Coast-inspired environment with coastal aesthetics, natural light, and relaxed atmosphere."
    };

    return descriptions[background] || "The scene should be set in a professional photography environment with appropriate lighting and aesthetic.";
};

// Gera descrição de iluminação
export const getLightingDescription = (lighting: string): string => {
    const descriptions: Record<string, string> = {
        "Studio Lighting": "Use professional studio lighting with controlled shadows and highlights.",
        "Golden Hour": "Use warm golden hour lighting with soft, warm tones and long shadows.",
        "Blue Hour": "Use blue hour lighting with cool, atmospheric tones and ambient glow.",
        "Overcast": "Use soft, diffused overcast lighting with even illumination and minimal shadows.",
        "Direct Sunlight": "Use bright direct sunlight with strong contrasts and defined shadows.",
        "Direct Sun": "Use direct sun lighting with vibrant highlights and deep shadows.",
        "Night Scene": "Use night scene lighting with artificial lights, shadows, and atmospheric ambiance.",
        "Cinematic": "Use cinematic lighting with dramatic contrasts, moody atmosphere, and film-like quality.",
        "Shadow overlay": "Use shadow overlay lighting with interesting shadow patterns and depth.",
        "Soft Light": "Use soft, gentle lighting with smooth transitions and minimal harsh shadows.",
        "Diffused": "Use diffused lighting with even, soft illumination throughout the scene.",
        "Natural Light": "Use natural daylight with authentic, organic lighting conditions.",
        "Daylight": "Use bright daylight with natural, clear illumination."
    };

    return descriptions[lighting] || "";
};

// Gera descrição de efeitos
export const getEffectDescription = (effect: string): string => {
    const descriptions: Record<string, string> = {
        "Bokeh": "Apply bokeh effect with beautiful out-of-focus background blur and light circles.",
        "Motion Blur": "Apply motion blur effect to create a sense of movement and dynamism.",
        "Vintage Film": "Apply vintage film aesthetic with grain, color grading, and nostalgic atmosphere.",
        "Monochrome": "Apply monochrome effect with black and white or single-color palette.",
        "Long Exposure": "Apply long exposure effect with smooth motion trails and ethereal quality.",
        "Lens Flare": "Apply lens flare effect with natural light flares and atmospheric glow.",
        "High Contrast": "Apply high contrast effect with strong blacks and whites, dramatic tones.",
        "Fish-eye lens": "Apply fish-eye lens effect with wide-angle distortion and unique perspective.",
        "Halftone": "Apply halftone effect with dot patterns and retro printing aesthetic."
    };

    return descriptions[effect] || "";
};

// Mapeia branding tags para backgrounds apropriados
export const getBackgroundsForBranding = (brandingTags: string[]): string[] => {
    const allBackgrounds = [...AVAILABLE_LOCATION_TAGS];
    const brandingBackgroundMap: Record<string, string[]> = {
        "Agriculture": ["Grass/Lawn", "Nature landscape", "Concrete", "Wooden Table"],
        "Casual": ["Grass/Lawn", "Wooden Table", "Nature landscape", "Urban City"],
        "Corporate": ["Modern Office", "Workspace", "Glass Environment", "Minimalist Studio", "Light Box"],
        "Creative": ["Glass Environment", "Modern Office", "Wooden Slat Wall", "Urban City"],
        "Crypto/Web3": ["Modern Office", "Glass Environment", "Urban City", "Minimalist Studio", "Light Box"],
        "Eco-friendly": ["Grass/Lawn", "Nature landscape", "Wooden Table", "Wooden Slat Wall"],
        "Energetic": ["Urban City", "Concrete", "Modern Office", "Nature landscape"],
        "Exclusive": ["Modern Office", "Glass Environment", "Minimalist Studio", "Light Box", "Workspace"],
        "Fashion": ["Minimalist Studio", "Light Box", "Glass Environment", "Modern Office", "Urban City"],
        "Feminine": ["Grass/Lawn", "Nature landscape", "Glass Environment", "Minimalist Studio", "Light Box"],
        "Food": ["Wooden Table", "Concrete", "Nature landscape", "Grass/Lawn"],
        "Friendly": ["Grass/Lawn", "Nature landscape", "Wooden Table", "Urban City"],
        "Handmade": ["Wooden Table", "Wooden Slat Wall", "Concrete", "Nature landscape"],
        "Health & Wellness": ["Nature landscape", "Grass/Lawn", "Modern Office", "Glass Environment"],
        "Industrial": ["Concrete", "Wooden Slat Wall", "Urban City", "Workspace"],
        "Kids & Baby": ["Grass/Lawn", "Nature landscape", "Wooden Table", "Urban City"],
        "Luxury": ["Modern Office", "Glass Environment", "Minimalist Studio", "Light Box", "Workspace"],
        "Minimalist": ["Minimalist Studio", "Light Box", "Glass Environment", "Modern Office", "Wooden Table"],
        "Modern": ["Modern Office", "Glass Environment", "Minimalist Studio", "Light Box", "Urban City"],
        "Playful": ["Grass/Lawn", "Nature landscape", "Urban City", "Wooden Table"],
        "Sport": ["Urban City", "Concrete", "Grass/Lawn", "Nature landscape"],
        "Tech": ["Modern Office", "Glass Environment", "Urban City", "Minimalist Studio", "Light Box"],
        "Travel & Hospitality": ["Nature landscape", "Urban City", "Grass/Lawn", "Modern Office"],
        "Vintage": ["Wooden Table", "Wooden Slat Wall", "Concrete", "Nature landscape"],
        "Elegant": ["Minimalist Studio", "Light Box", "Modern Office", "Glass Environment", "Workspace"]
    };

    // Se não há branding tags, retorna todos os backgrounds
    if (brandingTags.length === 0) {
        return allBackgrounds;
    }

    // Coleta backgrounds relevantes para cada branding tag
    const relevantBackgrounds = new Set<string>();
    brandingTags.forEach(tag => {
        const backgrounds = brandingBackgroundMap[tag] || [];
        backgrounds.forEach(bg => relevantBackgrounds.add(bg));
    });

    // Se encontrou backgrounds específicos, retorna eles + alguns aleatórios para variedade
    if (relevantBackgrounds.size > 0) {
        const relevantArray = Array.from(relevantBackgrounds);
        // Adiciona alguns backgrounds aleatórios para mais criatividade
        const randomBackgrounds = allBackgrounds
            .filter(bg => !relevantBackgrounds.has(bg))
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.min(3, allBackgrounds.length - relevantBackgrounds.size));

        return [...relevantArray, ...randomBackgrounds];
    }

    // Fallback: retorna todos os backgrounds
    return allBackgrounds;
};

// Filtra presets baseados em tags de branding
export const filterPresetsByBranding = <T extends { tags?: string[] }>(
    presets: T[],
    brandingTags: string[]
): T[] => {
    // Se não há branding tags, retorna todos os presets
    if (brandingTags.length === 0) {
        return presets;
    }

    // Se não há presets, retorna array vazio
    if (presets.length === 0) {
        return presets;
    }

    // Filtra presets que têm tags correspondentes ao branding
    const filtered = presets.filter(preset => {
        // Se preset não tem tags, inclui (para manter compatibilidade)
        if (!preset.tags || preset.tags.length === 0) {
            return true;
        }

        // Verifica se alguma tag do preset corresponde a alguma tag de branding
        return preset.tags.some(presetTag =>
            brandingTags.some(brandingTag =>
                presetTag.toLowerCase().includes(brandingTag.toLowerCase()) ||
                brandingTag.toLowerCase().includes(presetTag.toLowerCase())
            )
        );
    });

    // Se encontrou presets filtrados, retorna eles
    // Caso contrário, retorna todos os presets (fallback)
    return filtered.length > 0 ? filtered : presets;
};

// Seleciona um background aleatório baseado no branding
export const selectRandomBackground = (brandingTags: string[]): string => {
    const suitableBackgrounds = getBackgroundsForBranding(brandingTags);
    return suitableBackgrounds[Math.floor(Math.random() * suitableBackgrounds.length)];
};
