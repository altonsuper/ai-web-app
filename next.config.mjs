/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenAI-compatible public paths: /v1/* -> app/api/v1/*
  // (same handlers run locally with `next dev` and on Vercel)
  async rewrites() {
    return [{ source: "/v1/:path*", destination: "/api/v1/:path*" }];
  },
  async headers() {
    return [
      {
        source: "/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        ],
      },
    ];
  },
};
export default nextConfig;
