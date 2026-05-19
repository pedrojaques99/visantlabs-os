/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PluginService {
    /**
     * Execute plugin command
     * Send a command to the Figma plugin for processing
     * @param requestBody
     * @returns any Command executed
     * @throws ApiError
     */
    public static postPlugin(
        requestBody: {
            command: string;
            fileId: string;
        },
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/plugin',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get plugin documentation
     * Get plugin documentation
     * @returns any Plugin documentation (redirects to /docs/plugin)
     * @throws ApiError
     */
    public static getPluginDocs(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/plugin/docs',
        });
    }
    /**
     * Get MCP specification
     * Get MCP specification
     * @returns any MCP tool specifications
     * @throws ApiError
     */
    public static getPluginMcp(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/plugin/mcp',
        });
    }
}
