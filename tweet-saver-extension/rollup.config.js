/**
 * Rollup configuration for Social Media Note Saver Chrome Extension
 *
 * Bundles the extension into dist/ directory with:
 * - Separate bundles for content script, background, popup, and options
 * - Tree-shaking to eliminate unused code
 * - Optional minification for production
 * - Static asset copying (HTML, CSS, icons, manifest)
 */

import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Shared plugins for all bundles
 */
const commonPlugins = [
  resolve({
    browser: true
  })
];

/**
 * Production-only plugins (minification)
 */
const productionPlugins = isProduction ? [
  terser({
    format: {
      comments: false
    }
  })
] : [];

export default [
  // Content Script Bundle
  // Combines all content script dependencies into a single file
  {
    input: 'src/content.js',
    output: {
      file: 'dist/content.js',
      format: 'iife',
      name: 'SocialMediaSaver',
      sourcemap: !isProduction
    },
    plugins: [
      ...commonPlugins,
      ...productionPlugins
    ]
  },

  // Background Service Worker Bundle
  {
    input: 'src/background.js',
    output: {
      file: 'dist/background.js',
      format: 'es',
      sourcemap: !isProduction
    },
    plugins: [
      ...commonPlugins,
      ...productionPlugins
    ]
  },

  // Popup Script Bundle
  {
    input: 'src/popup.js',
    output: {
      file: 'dist/popup.js',
      format: 'es',
      sourcemap: !isProduction
    },
    plugins: [
      ...commonPlugins,
      ...productionPlugins
    ]
  },

  // Options Page Script Bundle
  {
    input: 'src/options.js',
    output: {
      file: 'dist/options.js',
      format: 'es',
      sourcemap: !isProduction
    },
    plugins: [
      ...commonPlugins,
      ...productionPlugins
    ]
  },

  // Localhost Bridge (standalone, no bundling needed)
  {
    input: 'src/localhost-bridge.js',
    output: {
      file: 'dist/localhost-bridge.js',
      format: 'iife',
      sourcemap: !isProduction
    },
    plugins: [
      ...commonPlugins,
      ...productionPlugins,
      // Copy static assets (only on first bundle to avoid duplicates)
      copy({
        targets: [
          // Manifest with updated paths
          { src: 'manifest.dist.json', dest: 'dist', rename: 'manifest.json' },
          // HTML files
          { src: 'popup.html', dest: 'dist' },
          { src: 'options.html', dest: 'dist' },
          // Styles
          { src: 'styles.css', dest: 'dist' },
          // Icons
          { src: 'icons', dest: 'dist' }
        ],
        hook: 'writeBundle'
      })
    ]
  }
];
