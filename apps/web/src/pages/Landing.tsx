import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import SEO from '../components/SEO';
import { useRefresh } from '../contexts/RefreshContext';
import { getFeaturedPhotos, getPreviewUrl } from '../api';
import { getConfig } from '../config';

interface FeaturedPhoto {
  id: string;
  event_slug: string;
  event_name: string;
  file_type: string;
  cache_version?: number;
  blur_placeholder: string | null;
}

// Cache featured-photo metadata so the home screen can paint an image
// immediately on load (especially in the mobile app), then refresh in the
// background. The preview image bytes are cached separately by the service
// worker, so a cached-then-revalidate metadata list is enough to always show
// something instantly. Bump the version suffix if FeaturedPhoto's shape changes.
const FEATURED_CACHE_KEY = 'featured_photos_cache_v1';

function readCachedFeatured(): FeaturedPhoto[] {
  try {
    const raw = localStorage.getItem(FEATURED_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeaturedPhoto[]) : [];
  } catch {
    return [];
  }
}

function writeCachedFeatured(photos: FeaturedPhoto[]): void {
  try {
    localStorage.setItem(FEATURED_CACHE_KEY, JSON.stringify(photos));
  } catch {
    /* storage full or unavailable — non-fatal, we just won't cache */
  }
}

export default function Landing() {
  const { registerRefreshHandler, unregisterRefreshHandler } = useRefresh();
  // Seed from cache so the first paint already has photos when available.
  const [featuredPhotos, setFeaturedPhotos] = useState<FeaturedPhoto[]>(readCachedFeatured);
  const [currentSlide, setCurrentSlide] = useState(0);
  // Only show the loading spinner when we have nothing cached to display.
  const [loading, setLoading] = useState(() => readCachedFeatured().length === 0);

  const loadFeaturedPhotos = async () => {
    try {
      const photos = await getFeaturedPhotos(10);
      // Map Photo type to FeaturedPhoto interface
      const featured = photos.map(p => ({
        id: p.id,
        event_slug: p.event_slug || '',
        event_name: p.event_name || '',
        file_type: p.file_type,
        cache_version: p.cache_version,
        blur_placeholder: p.blur_placeholder,
      }));
      setFeaturedPhotos(featured);
      writeCachedFeatured(featured);
    } catch (err) {
      console.error('Failed to load featured photos:', err);
      // Keep whatever cached photos are already on screen; only surface an
      // empty state if we had nothing to show in the first place.
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadFeaturedPhotos();
  };

  useEffect(() => {
    loadFeaturedPhotos();
  }, []);

  // Register refresh handler
  useEffect(() => {
    registerRefreshHandler(handleRefresh);
    return () => unregisterRefreshHandler();
  }, []);

  useEffect(() => {
    if (featuredPhotos.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % featuredPhotos.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [featuredPhotos.length]);


  const config = getConfig();
  
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.appName,
    url: window.location.origin,
    description: 'Professional event photography featuring ice skating, inline skating, and sports events',
    author: {
      '@type': 'Person',
      name: config.brandName,
      url: window.location.origin
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${window.location.origin}/events?search={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <SEO
        title={`${config.appName} - ${config.brandName} | Professional Event Photography`}
        description="Professional event photography featuring ice skating, inline skating, and sports events. Browse high-quality photos and download your favorites."
        keywords={`photography, sports photography, ice skating photography, inline skating, event photography, ${config.brandName}`}
        url={`https://${config.domain}/`}
        structuredData={structuredData}
      />
      {/* Hero Section with Slideshow */}
      <main>
        <section className="relative h-screen bg-black overflow-hidden" aria-label="Hero">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-white mb-4" />
              <div className="text-white text-xl">Loading...</div>
            </div>
          ) : featuredPhotos.length > 0 ? (
            <>
              {/* Slideshow Images */}
              {featuredPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    index === currentSlide ? 'opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden={index !== currentSlide}
                >
                  {photo.file_type === 'video/mp4' ? (
                    <video
                      src={getPreviewUrl(photo.event_slug, photo.id, photo.file_type, photo.cache_version)}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={getPreviewUrl(photo.event_slug, photo.id, photo.file_type, photo.cache_version)}
                      alt={photo.event_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
              ))}
            </>
         ) : null}
          
          {/* Hero Text Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/50">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 text-center px-4 drop-shadow-2xl">
              {config.brandName}
            </h1> <p className="text-lg md:text-xl text-white/90 mb-8 text-center px-6 max-w-xl">
  Thank you for celebrating with us and sharing your memories from our day.
</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 w-full max-w-2xl px-4">
              <Link
                to="/events"
                className="bg-white/90 backdrop-blur-sm text-gray-900 px-6 sm:px-8 py-4 rounded-xl text-base sm:text-lg font-semibold hover:bg-white active:scale-95 transition-all text-center flex-1 shadow-lg"
              >
                Share your photos
              </Link>
            </div>
          </div>
          </section>
</main>

  
    </div>
  );
}
