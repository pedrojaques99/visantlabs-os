import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getCurrentLocale } from '../utils/localeUtils';

const getSiteUrl = (): string => {
  if (typeof window !== 'undefined') {
    const viteUrl = (import.meta as any).env?.VITE_SITE_URL;
    if (viteUrl) return viteUrl;
    return window.location.origin;
  }
  return '';
};

export interface OrganizationSchemaProps {
  name?: string;
  description?: string;
  logo?: string;
  url?: string;
  sameAs?: string[];
}

export const OrganizationSchema: React.FC<OrganizationSchemaProps> = ({
  name = 'Visant Labs',
  description = 'Mockup generator with AI integration. Speedy asset creation and innovative design tools for creative professionals.',
  logo,
  url,  
  sameAs = [],
}) => {
  const siteUrl = getSiteUrl();
  const organizationUrl = url || siteUrl;
  const logoUrl = logo || `${siteUrl}/logo-vsn-labs.png`;

  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name,
      description,
      url: organizationUrl,
      logo: logoUrl,
      sameAs: sameAs.length > 0 ? sameAs : undefined,
    };

    let script = document.getElementById('organization-schema') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'organization-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById('organization-schema');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [name, description, logoUrl, organizationUrl, sameAs]);

  return null;
};

export interface SoftwareApplicationSchemaProps {
  name?: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: {
    price?: string;
    priceCurrency?: string;
  };
  aggregateRating?: {
    ratingValue: number;
    ratingCount: number;
  };
}

export const SoftwareApplicationSchema: React.FC<SoftwareApplicationSchemaProps> = ({
  name = 'Visant Labs Creative Tools',
  description = 'Mockup generator with AI integration. Speedy asset creation and innovative design tools for creative professionals.',
  applicationCategory = 'DesignApplication',
  operatingSystem = 'Web',
  offers,
  aggregateRating,
}) => {
  const siteUrl = getSiteUrl();

  useEffect(() => {
    const schema: any = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name,
      description,
      applicationCategory,
      operatingSystem,
      url: siteUrl,
    };

    if (offers) {
      schema.offers = {
        '@type': 'Offer',
        price: offers.price,
        priceCurrency: offers.priceCurrency || 'USD',
      };
    }

    if (aggregateRating) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue,
        ratingCount: aggregateRating.ratingCount,
      };
    }

    let script = document.getElementById('software-application-schema') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'software-application-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById('software-application-schema');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [name, description, applicationCategory, operatingSystem, offers, aggregateRating, siteUrl]);

  return null;
};

export interface BreadcrumbSchemaProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

export const BreadcrumbSchema: React.FC<BreadcrumbSchemaProps> = ({ items }) => {
  useEffect(() => {
    if (items.length === 0) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    };

    let script = document.getElementById('breadcrumb-schema') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'breadcrumb-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById('breadcrumb-schema');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [items]);

  return null;
};

export interface WebSiteSchemaProps {
  name?: string;
  description?: string;
  url?: string;
  potentialAction?: {
    target: string;
    'query-input': string;
  };
}

export const WebSiteSchema: React.FC<WebSiteSchemaProps> = ({
  name = 'Visant Labs',
  description = 'Mockup generator with AI integration. Speedy asset creation and innovative design tools for creative professionals.',
  url,
  potentialAction,
}) => {
  const siteUrl = url || getSiteUrl();

  useEffect(() => {
    const schema: any = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name,
      description,
      url: siteUrl,
    };

    if (potentialAction) {
      schema.potentialAction = {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: potentialAction.target,
        },
        'query-input': potentialAction['query-input'],
      };
    }

    let script = document.getElementById('website-schema') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'website-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById('website-schema');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [name, description, siteUrl, potentialAction]);

  return null;
};






