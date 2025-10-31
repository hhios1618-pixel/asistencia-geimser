'use client';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

export const isSecureForGeolocation = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  if (window.isSecureContext) {
    return true;
  }

  const { protocol, hostname } = window.location;

  if (protocol === 'https:') {
    return true;
  }

  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    return true;
  }

  return false;
};

export const insecureGeolocationMessage =
  'La geolocalización solo funciona en orígenes seguros. Abre la app con HTTPS (por ejemplo usando un túnel o certificado) o ejecútala desde http://localhost.';
