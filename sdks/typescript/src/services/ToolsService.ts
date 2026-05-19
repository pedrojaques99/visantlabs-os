/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ToolsService {
    /**
     * Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts, embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset classification).
     * Extract content from a local PDF file using a 2-phase pipeline: algorithmic (exact colors, fonts, embedded images) then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset classification). Returns markdownText (structured, page-separated — ideal for RAG chunking) plus brand tokens. IMPORTANT: before calling, ask the user: "Quer salvar o .md em disco ou receber o texto inline?"
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static documentExtract(
        requestBody: {
            /**
             * Absolute path to the local PDF file to extract.
             */
            pdf_path: string;
            /**
             * "disk" saves .md alongside the PDF. "inline" returns markdownText in the response.
             */
            output: 'disk' | 'inline';
            /**
             * Include colors, typography, strategy, assetClassifications. Default: true.
             */
            include_brand_tokens?: boolean;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/document_extract',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
}
