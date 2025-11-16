// Simple script to generate basic PNG icons from data URLs
// Run this in a browser console or Node.js environment

const fs = require('fs');
const path = require('path');

// Basic icon as base64 data URL (simple blue square with bookmark shape)
const iconSizes = [16, 32, 48, 128];

function generateIconSVG(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#1d9bf0" rx="${size * 0.15}"/>
    <path d="M${size * 0.25} ${size * 0.25} L${size * 0.75} ${size * 0.25} L${size * 0.75} ${size * 0.625} L${size * 0.5} ${size * 0.75} L${size * 0.25} ${size * 0.625} Z" fill="white"/>
    <circle cx="${size * 0.4}" cy="${size * 0.4}" r="${size * 0.03}" fill="#1d9bf0"/>
    <circle cx="${size * 0.6}" cy="${size * 0.4}" r="${size * 0.03}" fill="#1d9bf0"/>
  </svg>`;
}

// Generate SVG files for each size
iconSizes.forEach(size => {
  const svg = generateIconSVG(size);
  fs.writeFileSync(path.join(__dirname, 'icons', `icon${size}.svg`), svg);
  console.log(`Generated icon${size}.svg`);
});

console.log('Icon generation complete!');
console.log('To convert SVG to PNG, you can:');
console.log('1. Use an online converter like https://convertio.co/svg-png/');
console.log('2. Use ImageMagick: convert icon.svg icon.png');
console.log('3. Use the browser method in create-icons.html');