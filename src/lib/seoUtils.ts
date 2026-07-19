
/**
 * Utility for generating Schema.org JSON-LD for Generative Engine Optimization (GEO)
 */

export const generateTourSchema = (tour: any, siteUrl: string, settings?: any) => {
  const price = tour.discountPrice || tour.regularPrice;
  const siteName = settings?.siteName || "Gorilla ATV Adventure";
  
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": tour.title,
    "description": tour.description?.slice(0, 300) || tour.highlight || tour.title,
    "image": [
      tour.featuredImage,
      ...(tour.gallery || [])
    ].filter(Boolean),
    "brand": {
      "@type": "Brand",
      "name": siteName
    },
    "offers": {
      "@type": "Offer",
      "url": `${siteUrl}/tour/${tour.slug || tour.id}`,
      "priceCurrency": settings?.currency || "USD",
      "price": price,
      "availability": "https://schema.org/InStock",
      "validFrom": new Date().toISOString(),
      "seller": {
        "@type": "Organization",
        "name": siteName
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": tour.rating || 5.0,
      "reviewCount": tour.reviewsCount || 1
    }
  };
};

export const generateBlogSchema = (post: any, siteUrl: string, settings?: any) => {
  const siteName = settings?.siteName || "Gorilla ATV Adventure";
  
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "image": [post.featuredImage].filter(Boolean),
    "datePublished": post.publishedAt?.toDate?.()?.toISOString() || post.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    "author": {
      "@type": "Person",
      "name": post.author || siteName
    },
    "publisher": {
      "@type": "Organization",
      "name": siteName,
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/logo.png`
      }
    },
    "description": post.excerpt || post.title
  };
};

export const generateOrganizationSchema = (siteUrl: string, settings?: any) => {
  const siteName = settings?.siteName || "Gorilla ATV Adventure";
  
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "name": siteName,
    "url": siteUrl,
    "logo": `${siteUrl}/logo.png`,
    "sameAs": [
      settings?.facebookUrl,
      settings?.instagramUrl
    ].filter(Boolean),
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": settings?.supportPhone || "+62",
      "contactType": "customer service",
      "areaServed": "ID",
      "availableLanguage": ["en", "id"]
    },
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Badung",
      "addressRegion": "Bali",
      "addressCountry": "ID"
    }
  };
};

export const formatPageTitle = (title: string, siteName: string, format?: string) => {
  const defaultFormat = '{{title}} | {{siteName}}';
  return (format || defaultFormat)
    .replace('{{title}}', title)
    .replace('{{siteName}}', siteName);
};
