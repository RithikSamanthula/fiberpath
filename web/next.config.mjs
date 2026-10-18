/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["onnxruntime-node", "sharp"],
  // only the Linux x64 runtime is needed on the server; the other platforms would blow the function size limit
  outputFileTracingExcludes: {
    "/api/*": ["node_modules/onnxruntime-node/bin/napi-v*/darwin/**", "node_modules/onnxruntime-node/bin/napi-v*/win32/**", "node_modules/onnxruntime-node/bin/napi-v*/linux/arm64/**", "node_modules/@img/sharp-darwin*/**", "node_modules/@img/sharp-win32*/**"],
  },
  outputFileTracingIncludes: {
    "/api/*": ["./public/data/**/*.json"],
    "/api/detect": ["./models/**/*"],
  },
};
export default nextConfig;
