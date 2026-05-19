/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CanvasService {
    /**
     * List all canvas projects for the authenticated user.
     * List all canvas projects for the authenticated user.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static listCanvasProjects(
        requestBody: any,
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/list_canvas_projects',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Get a canvas project by ID.
     * Get a canvas project by ID.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static getCanvasProject(
        requestBody: {
            /**
             * Canvas project ID
             */
            canvasId: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/get_canvas_project',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Create a new canvas project.
     * Create a new canvas project.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static createCanvasProject(
        requestBody: {
            /**
             * Project name
             */
            name: string;
            /**
             * Initial canvas data (nodes, edges, etc.)
             */
            data?: Record<string, any>;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/create_canvas_project',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Update an existing canvas project.
     * Update an existing canvas project.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static updateCanvasProject(
        requestBody: {
            /**
             * Canvas project ID
             */
            canvasId: string;
            /**
             * Canvas data to update
             */
            data: Record<string, any>;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/update_canvas_project',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
    /**
     * Delete a canvas project by ID.
     * Delete a canvas project by ID.
     * @param requestBody
     * @returns any Tool executed successfully
     * @throws ApiError
     */
    public static deleteCanvasProject(
        requestBody: {
            /**
             * Canvas project ID
             */
            canvasId: string;
        },
    ): CancelablePromise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/mcp/tools/delete_canvas_project',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized — missing or invalid API key`,
                402: `Insufficient credits`,
            },
        });
    }
}
