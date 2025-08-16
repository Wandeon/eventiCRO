module.exports = {
  globDirectory: 'build/client/',
  globPatterns: ['**/*.{js,css,svg,woff2,png,ico}'],
  swSrc: 'sw.ts',
  swDest: 'build/client/sw.js',
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
};
