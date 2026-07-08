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
  return config;
};
