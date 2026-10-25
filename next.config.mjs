import { sparkBuildConfig } from './infrastructure/hosting/next-webpack.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, ...sparkBuildConfig() };
export default nextConfig;
