/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const backendUrl = process.env.ADMIN_API_BASE_URL ?? 'https://fifa-tpe.onrender.com/api';
    // Strip '/api' suffix if present to get base URL
    const destination = backendUrl.endsWith('/api')
      ? backendUrl.replace(/\/api$/, '')
      : backendUrl;
    return [
      {
        source: '/api/:path*',
        destination: `${destination}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
