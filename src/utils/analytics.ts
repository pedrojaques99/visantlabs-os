/**
 * Analytics utility for Himetrica tracking
 */

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

/**
 * Tracks a purchase completion event via Himetrica
 */
export const trackPurchase = (data: PurchaseEvent) => {
  if (typeof window !== 'undefined' && (window as any).himetrica) {
    try {
      (window as any).himetrica.track('purchase_completed', {
        product_id: data.product_id,
        price: data.price,
        currency: data.currency || 'USD',
        credits: data.credits
      });
      console.debug('📊 Analytics: purchase_completed tracked', data);
    } catch (error) {
      console.error('Failed to track purchase via Himetrica:', error);
    }
  } else {
    console.debug('📊 Analytics: Himetrica not found on window, skipping trackPurchase', data);
  }
};

/**
 * Identifies a user in Himetrica
 */
export const identifyUser = (identity: UserIdentity) => {
  if (typeof window !== 'undefined' && (window as any).himetrica) {
    try {
      (window as any).himetrica.identify({
        name: identity.name,
        email: identity.email,
        metadata: identity.metadata
      });
      console.debug('📊 Analytics: identifyUser called', identity.email);
    } catch (error) {
      console.error('Failed to identify user via Himetrica:', error);
    }
  }
};
