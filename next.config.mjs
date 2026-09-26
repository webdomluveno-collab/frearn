/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === "true";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isStaticExport
    ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
    : { images: { formats: ["image/avif", "image/webp"] } }),
};

export default nextConfig;
