/**
 * Analytics utility — Himetrica tracking + PostHog product analytics.
 *
 * PostHog is a no-op unless VITE_POSTHOG_KEY is set. In production it talks to
 * the same-origin `/ph` reverse proxy (see vercel.json) to dodge adblockers;
 * in dev it hits the US ingest host directly. Project region is US Cloud —
 * do not switch to eu.i.posthog.com/eu.posthog.com without migrating the project.
 */
import posthog from 'posthog-js';

export interface PurchaseEvent {
  product_id: string;
  price: number;
  currency?: string;
  credits?: number;
}

export interface UserIdentity {
  name?: string;
  email: string;
  metadata?: Record<string, any>;
}

const POSTHOG_KEY = (import.meta as any).env?.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  ((import.meta as any).env?.VITE_POSTHOG_HOST as string | undefined) ||
  ((import.meta as any).env?.PROD ? '/ph' : 'https://us.i.posthog.com');

let _posthogReady = false;

/**
 * Initializes PostHog (call once at app boot, before render).
 * Safe no-op without VITE_POSTHOG_KEY — nothing loads, nothing is sent.
 */
export const initAnalytics = () => {
  if (_posthogReady || !POSTHOG_KEY || typeof window === 'undefined') return;
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      ui_host: 'https://us.posthog.com',
      capture_pageview: 'history_change', // SPA route changes
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
    _posthogReady = true;

    // authService dispatches this on setToken/clearToken; token=null → logout
    window.addEventListener('auth_token_changed', (event) => {
      const token = (event as CustomEvent).detail?.token;
      if (!token) {
        posthog.reset();
        _lastIdentifiedEmail = null;
      }
    });
  } catch (error) {
    console.error('Failed to init PostHog:', error);
  }
};

/**
 * Captures a product event in PostHog (no-op when PostHog is not configured).
 */
export const trackEvent = (event: string, properties?: Record<string, any>) => {
  if (!_posthogReady) return;
  try {
    posthog.capture(event, properties);
  } catch (error) {
    console.error('Failed to track event via PostHog:', error);
  }
};

/**
 * Tracks a purchase completion event via Himetrica + PostHog
 */
export const trackPurchase = (data: PurchaseEvent) => {
  trackEvent('checkout_completed', {
    product_id: data.product_id,
    price: data.price,
    currency: data.currency || 'USD',
    credits: data.credits,
  });
  if (typeof window !== 'undefined' && (window as any).himetrica) {
    try {
      (window as any).himetrica.track('purchase_completed', {
        product_id: data.product_id,
        price: data.price,
        currency: data.currency || 'USD',
        credits: data.credits,
      });
      console.debug('📊 Analytics: purchase_completed tracked', data);
    } catch (error) {
      console.error('Failed to track purchase via Himetrica:', error);
    }
  } else {
    console.debug('📊 Analytics: Himetrica not found on window, skipping trackPurchase', data);
  }
};

let _lastIdentifiedEmail: string | null = null;

/**
 * Identifies a user in Himetrica + PostHog (deduped — only fires once per email per session)
 */
export const identifyUser = (identity: UserIdentity) => {
  if (_lastIdentifiedEmail === identity.email) return;
  if (_posthogReady) {
    try {
      // Stable user id as distinct_id; person props kept to the ICP-relevant set
      posthog.identify(identity.metadata?.id || identity.email, {
        email: identity.email,
        name: identity.name,
        tier: identity.metadata?.subscriptionTier,
        subscription_status: identity.metadata?.subscriptionStatus,
        user_category: identity.metadata?.userCategory,
      });
    } catch (error) {
      console.error('Failed to identify user via PostHog:', error);
    }
  }
  if (typeof window !== 'undefined' && (window as any).himetrica) {
    try {
      (window as any).himetrica.identify({
        name: identity.name,
        email: identity.email,
        metadata: identity.metadata,
      });
      _lastIdentifiedEmail = identity.email;
      console.debug('📊 Analytics: identifyUser called', identity.email);
    } catch (error) {
      console.error('Failed to identify user via Himetrica:', error);
    }
  } else {
    _lastIdentifiedEmail = identity.email;
  }
};
