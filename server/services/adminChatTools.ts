import { Type } from '@google/genai';
import { mockupApi } from '../../src/services/mockupApi.js';
import { prisma } from '../db/prisma.js';

export const ADMIN_CHAT_TOOLS = [{
  functionDeclarations: [
    {
      name: 'generate_or_update_mockup',
      description: 'Generate or regenerate a mockup image and save as editable Creative Project',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: {
            type: Type.STRING,
            description: 'Design brief describing the mockup to generate'
          },
          creativeProjectId: {
            type: Type.STRING,
            description: 'Existing Creative Project ID to update (optional, leave empty to create new)'
          },
          brandGuidelineId: {
            type: Type.STRING,
            description: 'Brand guideline ID for context injection (optional)'
          },
          model: {
            type: Type.STRING,
            description: 'Gemini model to use',
            enum: ['gemini-2.0-flash', 'gemini-2.0-pro']
          },
          resolution: {
            type: Type.STRING,
            description: 'Image resolution',
            enum: ['1024x1024', '1280x720', '1600x900']
          },
          aspectRatio: {
            type: Type.STRING,
            description: 'Aspect ratio of the generated image',
            enum: ['1:1', '16:9', '3:2']
          }
        },
        required: ['prompt']
      }
    }
  ]
}];

interface GenerateMockupArgs {
  prompt: string;
  creativeProjectId?: string;
  brandGuidelineId?: string;
  model?: string;
  resolution?: string;
  aspectRatio?: string;
}

export async function executeAdminChatTool(
  toolName: string,
  args: GenerateMockupArgs,
  userId: string,
  sessionId: string
): Promise<any> {
  if (toolName !== 'generate_or_update_mockup') {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    console.log('[AdminChatTools] Generating mockup:', {
      prompt: args.prompt.substring(0, 100),
      creativeProjectId: args.creativeProjectId,
      sessionId
    });

    // 1. Generate image via mockupApi
    const imageResult = await mockupApi.generate({
      promptText: args.prompt,
      brandGuidelineId: args.brandGuidelineId,
      model: args.model || 'gemini-2.0-flash',
      resolution: args.resolution || '1024x1024',
      aspectRatio: args.aspectRatio || '1:1',
      feature: 'canvas',
      provider: 'gemini'
    });

    const imageUrl = imageResult.imageUrl || `data:image/png;base64,${imageResult.imageBase64}`;

    console.log('[AdminChatTools] Image generated, now saving Creative Project');

    // 2. Either create new or update existing Creative Project
    let creativeProjectId = args.creativeProjectId;

    if (creativeProjectId) {
      // Update existing
      await prisma.creativeProject.update({
        where: { id: creativeProjectId },
        data: {
          backgroundUrl: imageUrl,
          prompt: args.prompt,
          updatedAt: new Date()
        }
      });

      console.log('[AdminChatTools] Updated existing Creative Project:', creativeProjectId);
    } else {
      // Create new
      const created = await prisma.creativeProject.create({
        data: {
          userId,
          name: `Admin Chat Mockup - ${new Date().toLocaleDateString('pt-BR')}`,
          prompt: args.prompt,
          backgroundUrl: imageUrl,
          format: args.aspectRatio || '1:1',
          brandId: args.brandGuidelineId,
          layers: JSON.stringify([]),
          adminChatSessionId: sessionId
        }
      });

      creativeProjectId = created.id;

      console.log('[AdminChatTools] Created new Creative Project:', creativeProjectId);
    }

    const result = {
      success: true,
      creativeProjectId,
      imageUrl,
      editUrl: `/create?project=${creativeProjectId}`,
      prompt: args.prompt,
      creditsDeducted: imageResult.creditsDeducted,
      creditsRemaining: imageResult.creditsRemaining
    };

    console.log('[AdminChatTools] Tool execution complete:', result);

    return result;
  } catch (error: any) {
    console.error('[AdminChatTools] Error executing tool:', error);
    throw error;
  }
}
