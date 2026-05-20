const LOCAL_DEVELOPMENT_CONNECT_SOURCES = [
  'http://localhost:*',
  'http://127.0.0.1:*',
  'ws://localhost:*',
  'ws://127.0.0.1:*',
];

const BUTTERBASE_CONNECT_SOURCES = [
  'https://api.butterbase.ai',
  'wss://api.butterbase.ai',
];

const TURNSTILE_SOURCES = ['https://challenges.cloudflare.com'];

function compactSources(sources) {
  return Array.from(new Set(sources.filter(Boolean)));
}

function originFromEnv(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function websocketOriginFromHttpOrigin(origin) {
  if (!origin) {
    return null;
  }

  try {
    const url = new URL(origin);

    if (url.protocol === 'https:') {
      url.protocol = 'wss:';
    } else if (url.protocol === 'http:') {
      url.protocol = 'ws:';
    }

    return url.origin;
  } catch {
    return null;
  }
}

function serializeContentSecurityPolicy(directives) {
  return Object.entries(directives)
    .map(([directive, sources]) =>
      sources.length > 0 ? `${directive} ${sources.join(' ')}` : directive
    )
    .join('; ');
}

function buildContentSecurityPolicy({ isProduction }) {
  const butterbaseOrigin = originFromEnv(
    process.env.NEXT_PUBLIC_BUTTERBASE_API_URL
  );
  const butterbaseRealtimeOrigin =
    websocketOriginFromHttpOrigin(butterbaseOrigin);

  return serializeContentSecurityPolicy({
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'frame-src': TURNSTILE_SOURCES,
    'form-action': ["'self'"],
    'script-src': compactSources([
      "'self'",
      ...TURNSTILE_SOURCES,
      "'unsafe-inline'",
      isProduction ? null : "'unsafe-eval'",
    ]),
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': compactSources([
      "'self'",
      ...BUTTERBASE_CONNECT_SOURCES,
      ...TURNSTILE_SOURCES,
      butterbaseOrigin,
      butterbaseRealtimeOrigin,
      ...(isProduction ? [] : LOCAL_DEVELOPMENT_CONNECT_SOURCES),
    ]),
    'media-src': ["'self'", 'blob:', 'https:'],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    ...(isProduction ? { 'upgrade-insecure-requests': [] } : {}),
  });
}

function buildSecurityHeaders() {
  const isProduction = process.env.NODE_ENV === 'production';
  const headers = [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy({ isProduction }),
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value:
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    },
  ];

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains',
    });
  }

  return headers;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

module.exports = nextConfig;
