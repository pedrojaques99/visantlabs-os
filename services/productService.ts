export interface Product {
    id: string;
    productId: string;
    type: 'credit_package' | 'subscription_plan';
    name: string;
    description: string | null;
    credits: number;
    priceBRL: number;
    priceUSD: number | null;
    stripeProductId: string | null;
    abacateProductId: string | null;
    abacateBillId: string | null;
    paymentLinkBRL: string | null;
    paymentLinkUSD: string | null;
    metadata: any | null;
    isActive: boolean;
    displayOrder: number;
}

class ProductService {
    private products: Product[] = [];
    private lastFetch: number = 0;
    private CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

    async getProducts(forceRefresh = false): Promise<Product[]> {
        const now = Date.now();
        if (!forceRefresh && this.products.length > 0 && (now - this.lastFetch < this.CACHE_DURATION)) {
            return this.products;
        }

        try {
            const response = await fetch('/api/payments/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            const data = await response.json();
            this.products = data;
            this.lastFetch = now;
            return data;
        } catch (error) {
            console.error('Error fetching products:', error);
            return this.products; // Return cached if available, or empty
        }
    }

    async getCreditPackages(): Promise<Product[]> {
        const products = await this.getProducts();
        return products
            .filter(p => p.type === 'credit_package' && p.isActive)
            .sort((a, b) => a.displayOrder - b.displayOrder);
    }

    async getSubscriptionPlans(): Promise<Product[]> {
        const products = await this.getProducts();
        return products
            .filter(p => p.type === 'subscription_plan' && p.isActive)
            .sort((a, b) => a.displayOrder - b.displayOrder);
    }

    getProductByCredits(credits: number): Product | undefined {
        return this.products.find(p => p.type === 'credit_package' && p.credits === credits);
    }
}

export const productService = new ProductService();
