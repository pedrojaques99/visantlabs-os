import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getCurrentLocale } from '../utils/localeUtils';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
  locale?: string;
}

const getSiteUrl = (): string => {
  if (typeof window !== 'undefined') {
    const viteUrl = (import.meta as any).env?.VITE_SITE_URL;
    if (viteUrl) return viteUrl;
    return window.location.origin;
  }
  return '';
};

const defaultTitle = 'Visant Labs® | Tools for Designers';
const defaultDescription = 'Mockup generator with AI integration. Speedy asset creation and innovative design tools for creative professionals.';

/**
 * Default Open Graph Image
 * 
 * Place your OG image in the public/ folder (recommended: 1200x630px)
 * Examples:
 * - /og-image.png
 * - /og-image.jpg  
 * - /images/og-default.png
 * 
 * To use a custom image per page, pass the `image` prop to the SEO component:
 * <SEO image="/custom-page-image.png" ... />
 */
const defaultImage = '/og-image.png'; // OG image (recommended: 1200x630px)
const defaultUrl = getSiteUrl();

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  image = defaultImage,
  url,
  type = 'website',
  noindex = false,
  locale,
}) => {
  const location = useLocation();
  const currentLocale = locale || getCurrentLocale();
  const siteUrl = getSiteUrl();
  const currentUrl = url || `${siteUrl}${location.pathname}${location.search}`;
  const fullTitle = title ? `${title} | Visant Labs®` : defaultTitle;
  const finalDescription = description || defaultDescription;
  const imageUrl = image.startsWith('http') ? image : `${siteUrl}${image}`;
  const finalUrl = url || currentUrl;

  useEffect(() => {
    // Update title
    document.title = fullTitle;

    // Helper to update or create meta tag
    const updateMetaTag = (property: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, property);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Helper to update or create link tag
    const updateLinkTag = (rel: string, href: string, hreflang?: string) => {
      const selector = hreflang 
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]`;
      let element = document.querySelector(selector) as HTMLLinkElement;
      
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        if (hreflang) element.setAttribute('hreflang', hreflang);
        document.head.appendChild(element);
      }
      
      element.setAttribute('href', href);
    };

    // Basic meta tags
    updateMetaTag('description', finalDescription);
    if (keywords) {
      updateMetaTag('keywords', keywords);
    }

    // Robots
    if (noindex) {
      updateMetaTag('robots', 'noindex, nofollow');
    } else {
      updateMetaTag('robots', 'index, follow');
    }

    // Open Graph
    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', finalDescription, true);
    updateMetaTag('og:image', imageUrl, true);
    updateMetaTag('og:image:width', '1200', true);
    updateMetaTag('og:image:height', '630', true);
    updateMetaTag('og:image:alt', fullTitle, true);
    updateMetaTag('og:url', finalUrl, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', 'Visant Labs®', true);
    updateMetaTag('og:locale', currentLocale === 'pt-BR' ? 'pt_BR' : 'en_US', true);

    // Twitter Card
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', finalDescription);
    updateMetaTag('twitter:image', imageUrl);

    // Canonical URL
    updateLinkTag('canonical', finalUrl);

    // Language alternates (hreflang)
    const basePath = location.pathname;
    const currentLangPath = currentLocale === 'pt-BR' ? 'pt-BR' : 'en-US';
    
    // Add current language
    updateLinkTag('alternate', finalUrl, currentLangPath);
    
    // Add alternate language (if different)
    const altLang = currentLocale === 'pt-BR' ? 'en-US' : 'pt-BR';
    const altUrl = finalUrl; // Same URL for now, can be customized per page
    updateLinkTag('alternate', altUrl, altLang);
    
    // Add x-default
    updateLinkTag('alternate', finalUrl, 'x-default');

    // Update html lang attribute
    document.documentElement.lang = currentLocale === 'pt-BR' ? 'pt-BR' : 'en-US';

  }, [fullTitle, finalDescription, keywords, imageUrl, finalUrl, type, noindex, currentLocale, location.pathname, location.search]);

  return null;
};

