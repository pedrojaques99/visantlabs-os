import express, { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface FigmaOperation {
  type: string;
  props?: any;
  nodeId?: string;
  color?: any;
  [key: string]: any;
}

interface ColorVariable {
  id: string;
  name: string;
  value?: string;
}

interface PluginRequest {
  command: string;
  selectedElements: any[];
  selectedLogo?: { id: string; name: string };
  selectedBrandFont?: { id: string; name: string };
  selectedBrandColors?: Array<{ name: string; value: string }>;
  availableComponents?: any[];
  availableColorVariables?: ColorVariable[];
  availableFontVariables?: any[];
}

// POST /plugin - Generate design operations from natural language command
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      command,
      selectedElements,
      selectedLogo,
      selectedBrandFont,
      selectedBrandColors,
      availableComponents = [],
      availableColorVariables = [],
      availableFontVariables = [],
      apiKey: userApiKey
    } = req.body as PluginRequest & { apiKey?: string };

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // BYOK: use user's key if provided, else fall back to server key
    const effectiveKey = userApiKey || process.env.GEMINI_API_KEY || '';
    if (!effectiveKey) {
      return res.status(400).json({ error: 'No API key configured. Please add your Gemini API key in plugin settings.' });
    }
    const genAIInstance = new GoogleGenerativeAI(effectiveKey);


    // Build a very specific prompt to prevent hallucinations
    const brandColorsInfo = selectedBrandColors?.length
      ? selectedBrandColors.map(c => `${c.name}: ${c.value}`).join(', ')
      : 'None selected';

    const prompt = `
You are a STRICT Figma design system applier. You ONLY use the exact values provided below.

USER SELECTIONS (MUST USE THESE EXACTLY):
- Logo Component: ${selectedLogo.name} (ID: ${selectedLogo.id})
- Brand Font: ${selectedBrandFont.name} (ID: ${selectedBrandFont.id})
- Brand Colors: ${brandColorsInfo}

COMMAND: "${command}"

SELECTED ELEMENTS IN DESIGN (apply changes to these):
${selectedElements.map((el, i) => `${i + 1}. ${el.name} (type: ${el.type}, id: ${el.id})`).join('\n')}

RULES (YOU MUST FOLLOW THESE):
1. ONLY use the selected logo, font, and colors above
2. Do NOT invent or hallucinate any colors, fonts, or components
3. If the command asks for something NOT in your selections, IGNORE that part
4. Only generate operations for existing selected elements
5. Use EXACT IDs provided above - never make up IDs
6. Return ONLY a valid JSON array - no other text

VALID OPERATION TYPES:
- SET_FILL: Change color of an element { "type": "SET_FILL", "nodeId": "...", "color": { "r": X, "g": X, "b": X, "a": 1 } }
- APPLY_STYLE: Apply a text/fill style { "type": "APPLY_STYLE", "nodeId": "...", "styleId": "...", "styleType": "TEXT" | "FILL" }
- APPLY_VARIABLE: Apply a variable { "type": "APPLY_VARIABLE", "nodeId": "...", "variableId": "...", "property": "fill" | "fontFamily" }

If you cannot complete the operation with the provided selections, return an empty array [].

Generate operations in JSON format only:
`;

    // Call Gemini API
    const model = genAIInstance.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('AI Response:', responseText);

    // Parse the response - extract JSON array
    let operations: FigmaOperation[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        operations = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, try to parse the whole response
        operations = JSON.parse(responseText);
      }

      // Validate it's an array
      if (!Array.isArray(operations)) {
        operations = [];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      // Return empty array instead of error - AI might not have operations to do
      operations = [];
    }

    // Validate operations have required fields
    operations = operations.filter(op =>
      op.type && (op.nodeId || op.props)
    );

    // Return operations to apply
    res.json({
      success: true,
      operations,
      message: `Generated ${operations.length} operation(s)`
    });
  } catch (error: any) {
    console.error('Plugin route error:', error);
    res.status(500).json({
      error: 'Failed to process command',
      message: error.message
    });
  }
});

export default router;
