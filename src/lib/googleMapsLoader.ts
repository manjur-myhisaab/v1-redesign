import { GOOGLE_MAP_KEY } from '@/services/server';

let googleMapsPromise: Promise<any> | null = null;
let isGoogleMapsLoaded = false;

const getApiKey = () => {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAP_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim() !== '') {
    return envKey.trim().replace(/^['"]|['"]$/g, '');
  }
  if (GOOGLE_MAP_KEY && typeof GOOGLE_MAP_KEY === 'string' && GOOGLE_MAP_KEY.trim() !== '') {
    return GOOGLE_MAP_KEY.trim().replace(/^['"]|['"]$/g, '');
  }
  return 'AIzaSyA90aWDPhPdtiPdoyfo_6YGA3TWl0wEqwM';
};

export const loadGoogleMaps = (libraries: string[] = ['geometry']): Promise<any> => {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.Map) {
    isGoogleMapsLoaded = true;
    return Promise.resolve((window as any).google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('Document not available'));
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if ((window as any).google?.maps?.Map) {
          clearInterval(checkInterval);
          isGoogleMapsLoaded = true;
          resolve((window as any).google.maps);
        } else if (attempts > 100) {
          clearInterval(checkInterval);
          googleMapsPromise = null;
          reject(new Error('Google Maps loading timeout'));
        }
      }, 100);
      return;
    }

    const apiKey = getApiKey();
    const script = document.createElement('script');
    const librariesParam = libraries.join(',');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${librariesParam}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isGoogleMapsLoaded = true;
      resolve((window as any).google.maps);
    };

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
};
