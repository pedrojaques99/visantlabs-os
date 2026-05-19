/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuthService {
    /**
     * Sign up a new user
     * Create a new account with email and password
     * @param requestBody
     * @returns any User created successfully
     * @throws ApiError
     */
    public static postAuthSignup(
        requestBody: {
            email: string;
            password: string;
            username?: string;
        },
    ): CancelablePromise<{
        userId?: string;
        token?: string;
    }> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/signup',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error`,
            },
        });
    }
    /**
     * User login
     * Authenticate user and return JWT token
     * @param requestBody
     * @returns any Login successful
     * @throws ApiError
     */
    public static postAuthLogin(
        requestBody: {
            email: string;
            password: string;
        },
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Invalid credentials`,
            },
        });
    }
    /**
     * User logout
     * User logout
     * @returns any Logged out successfully
     * @throws ApiError
     */
    public static postAuthLogout(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/logout',
        });
    }
    /**
     * Get current user profile
     * Get current user profile
     * @returns any User profile
     * @throws ApiError
     */
    public static getAuthProfile(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/auth/profile',
        });
    }
    /**
     * Update user profile
     * Update user profile
     * @param requestBody
     * @returns any Profile updated
     * @throws ApiError
     */
    public static putAuthProfile(
        requestBody: Record<string, any>,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/auth/profile',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Refresh JWT token
     * Refresh JWT token
     * @param requestBody
     * @returns any New token generated
     * @throws ApiError
     */
    public static postAuthRefresh(
        requestBody: {
            refreshToken?: string;
        },
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/refresh',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Verify email address
     * Verify email address
     * @param requestBody
     * @returns any Email verified
     * @throws ApiError
     */
    public static postAuthVerifyEmail(
        requestBody: {
            token?: string;
        },
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/auth/verify-email',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
