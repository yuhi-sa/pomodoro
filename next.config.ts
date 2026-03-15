import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/pomodoro',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
