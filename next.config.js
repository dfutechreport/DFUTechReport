/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Vercel build alırken ESLint uyarılarını yoksayar
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Vercel build alırken TypeScript hatalarını yoksayar
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig