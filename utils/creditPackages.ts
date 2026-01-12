export interface CreditPackage {
  credits: number;
  price: {
    USD?: number;
    BRL: number;
  };
  stripeProductId?: string;
  abacateProductId?: string;
  abacateBillId?: string;
  paymentLinks?: {
    USD?: string;
    BRL?: string;
  };
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    credits: 20,
    price: {
      BRL: 9.90,
    },
    stripeProductId: 'prod_TSoYT6iN6okzqj',
    abacateProductId: 'prod_zdQYnPAABMH2uHGbyGRaxkG1',
    abacateBillId: 'bill_TNSpGheWqrAxn3SDB4fFrtr5',
    paymentLinks: {
      BRL: 'https://buy.stripe.com/aFa6oA4A76hK2VUfVE0gw02',
    },
  },
  {
    credits: 50,
    price: {
      BRL: 25.90,
    },
    stripeProductId: 'prod_TXViJlOBGY0yTa',
    abacateProductId: 'prod_mMqpXU4tf2AH2npuA6cFbc2p',
    abacateBillId: 'bill_6C3nzx6rNp4YkBkpbuS44qBf',
    paymentLinks: {
      BRL: 'https://buy.stripe.com/9B6eV65EbdKc3ZYaBk0gw08',
    },
  },
  {
    credits: 100,
    price: {
      BRL: 45.90,
    },
    stripeProductId: 'prod_TSoesFFm3kKj1E',
    abacateProductId: 'prod_MN0dSHSsA6KaMHxcB4YSHbxe',
    abacateBillId: 'bill_RS6ytpErrsHZC42fdBtqXQ51',
    paymentLinks: {
      BRL: 'https://buy.stripe.com/28E00c4A7eOg0NM38S0gw09',
    },
  },
  {
    credits: 500,
    price: {
      BRL: 198.00,
    },
    stripeProductId: 'prod_TSoiFWVxxng27m',
    abacateProductId: 'prod_UZc3hQYhUUCetjXxm002pG6R',
    abacateBillId: 'bill_GSXJBRdEmgb1Mep4X5AtTFAn',
    paymentLinks: {
      BRL: 'https://buy.stripe.com/3cI8wI9Ur0Xq9ki5h00gw07',
    },
  },
];

export const getCreditPackageLink = (credits: number, currency: string): string => {
  const package_ = CREDIT_PACKAGES.find(p => p.credits === credits);
  if (!package_ || !package_.paymentLinks) return '';

  // Try requested currency first, fallback to BRL if not available
  if (currency === 'USD' && package_.paymentLinks.USD) {
    return package_.paymentLinks.USD;
  }

  return package_.paymentLinks.BRL || '';
};

export const getCreditPackage = (credits: number): CreditPackage | undefined => {
  return CREDIT_PACKAGES.find(p => p.credits === credits);
};

export const getCreditPackagePrice = (credits: number, currency: string): number => {
  const package_ = CREDIT_PACKAGES.find(p => p.credits === credits);
  if (!package_) return 0;

  // Try requested currency first, fallback to BRL if not available
  if (currency === 'USD' && package_.price.USD) {
    return package_.price.USD;
  }

  return package_.price.BRL || 0;
};

export const getCreditsByAmount = (amountTotalInMinorUnits: number, currency?: string): number => {
  if (!amountTotalInMinorUnits || amountTotalInMinorUnits <= 0) {
    return 0;
  }

  const normalizedCurrency = currency ? currency.toUpperCase() : undefined;

  // First try exact match for performance (no coupon case)
  for (const creditPackage of CREDIT_PACKAGES) {
    for (const [priceCurrency, priceValue] of Object.entries(creditPackage.price)) {
      if (priceValue === undefined) continue;

      const priceCurrencyCode = priceCurrency.toUpperCase();
      if (normalizedCurrency && priceCurrencyCode !== normalizedCurrency) continue;

      const priceInMinorUnits = Math.round(priceValue * 100);
      if (priceInMinorUnits === amountTotalInMinorUnits) {
        return creditPackage.credits;
      }
    }
  }

  // Fallback: ignore currency for exact match
  for (const creditPackage of CREDIT_PACKAGES) {
    for (const priceValue of Object.values(creditPackage.price)) {
      if (priceValue === undefined) continue;
      const priceInMinorUnits = Math.round(priceValue * 100);
      if (priceInMinorUnits === amountTotalInMinorUnits) {
        return creditPackage.credits;
      }
    }
  }

  // If no exact match, try to find package with coupon (value <= package price)
  // Sort packages by price (highest to lowest) to correctly identify which package was purchased
  // Build list of all packages with their prices, prioritizing currency match
  const allPackages: Array<{ package: CreditPackage; price: number; priceInMinorUnits: number; currency: string }> = [];

  for (const creditPackage of CREDIT_PACKAGES) {
    for (const [priceCurrency, priceValue] of Object.entries(creditPackage.price)) {
      if (priceValue === undefined) continue;

      const priceCurrencyCode = priceCurrency.toUpperCase();
      const priceInMinorUnits = Math.round(priceValue * 100);

      allPackages.push({
        package: creditPackage,
        price: priceValue,
        priceInMinorUnits,
        currency: priceCurrencyCode,
      });
    }
  }

  // Sort by price (lowest to highest) to find the correct package
  // This ensures we match the lowest package that covers the amount (handling coupons)
  allPackages.sort((a, b) => a.price - b.price);

  // First try packages matching the requested currency
  if (normalizedCurrency) {
    for (const { package: creditPackage, priceInMinorUnits, currency } of allPackages) {
      if (currency === normalizedCurrency && amountTotalInMinorUnits <= priceInMinorUnits) {
        return creditPackage.credits;
      }
    }
  }

  // Fallback: try all packages regardless of currency
  for (const { package: creditPackage, priceInMinorUnits } of allPackages) {
    if (amountTotalInMinorUnits <= priceInMinorUnits) {
      return creditPackage.credits;
    }
  }

  return 0;
};

export const getAbacateBillId = (credits: number): string | null => {
  const package_ = CREDIT_PACKAGES.find(p => p.credits === credits);
  return package_?.abacateBillId || null;
};

