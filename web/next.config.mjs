const nextConfig = {
  serverExternalPackages: ["onnxruntime-node", "sharp"],
  outputFileTracingExcludes: {
    "/api/*": ["node_modules/onnxruntime-node/bin/napi-v*/darwin/**", "node_modules/onnxruntime-node/bin/napi-v*/win32/**", "node_modules/onnxruntime-node/bin/napi-v*/linux/arm64/**", "node_modules/@img/sharp-darwin*/**", "node_modules/@img/sharp-win32*/**"],
  },
  outputFileTracingIncludes: {
    "/api/*": ["./public/data/**/*.json"],
    "/api/detect": ["./models/**/*", "./node_modules/onnxruntime-node/bin/napi-v*/linux/x64/**/*", "./node_modules/onnxruntime-node/lib/**/*", "./node_modules/onnxruntime-common/**/*"],
  },
};
export default nextConfig;
