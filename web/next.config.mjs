/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  outputFileTracingIncludes: {
    "/api/*": ["./public/data/**/*.json"],
    "/api/detect": ["./models/**/*"],
  },
};
export default nextConfig;
