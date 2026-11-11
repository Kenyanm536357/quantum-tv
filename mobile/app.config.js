module.exports = ({ config }) => {
  const android = config.android || {};
  if (Array.isArray(android.permissions)) {
    android.permissions = [...new Set(android.permissions)];
  }
  if (Array.isArray(android.intentFilters)) {
    const seen = new Set();
    android.intentFilters = android.intentFilters.filter((f) => {
      const k = JSON.stringify(f);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  // App Review 2.5.19: the iOS binary must be static, so no OTA code/content swaps.
  if (process.env.EAS_BUILD_PLATFORM === "ios") {
    config.updates = { enabled: false };
    config.ios = { ...(config.ios || {}), buildNumber: "10" };
  }
  config.plugins = [...(config.plugins || []), require("./plugins/withAutoBoot")];
  return config;
};
