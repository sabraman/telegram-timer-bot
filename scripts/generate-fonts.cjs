#!/usr/bin/env node

/**
 * Font Generation Script for iOS Compatibility
 *
 * This script generates static fonts with different widths using @web-alchemy/fonttools
 * Generated fonts are placed in public/fonts/generated/ for use in production
 */

const fs = require('fs');
const path = require('path');
const { instantiateVariableFont } = require('@web-alchemy/fonttools');

async function generateFonts() {
  console.log('🔧 Generating static fonts for iOS compatibility...');

  try {
    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../public/fonts/generated');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('📁 Created output directory:', outputDir);
    }

    // Load the original variable font
    const fontPath = path.join(__dirname, '../public/fonts/HeadingNowVariable-Regular.ttf');
    const fontBuffer = fs.readFileSync(fontPath);
    console.log(`📖 Loaded original font: ${(fontBuffer.byteLength / 1024).toFixed(1)} KB`);

    // Generate fonts with different widths and weights

    // Ultra-Condensed (width 1000) for 0-9 seconds
    console.log('🔧 Generating ultra-condensed font...');
    const condensedFont = await instantiateVariableFont(fontBuffer, {
      wght: [1000, 1000], // Fixed weight 1000
      wdth: [1000, 1000], // Ultra-condensed width
    });

    // Normal (width 410) for 10-60 seconds
    console.log('🔧 Generating normal font...');
    const normalFont = await instantiateVariableFont(fontBuffer, {
      wght: [1000, 1000], // Fixed weight 1000
      wdth: [410, 410],   // Condensed width
    });

    // Extended (width 170) for MM:SS format
    console.log('🔧 Generating extended font...');
    const extendedFont = await instantiateVariableFont(fontBuffer, {
      wght: [1000, 1000], // Fixed weight 1000
      wdth: [170, 170],   // Extended width
    });

    // Write generated fonts to files
    const fonts = [
      { name: 'HeadingNowCondensed.ttf', buffer: condensedFont, description: 'Ultra-condensed (0-9s)' },
      { name: 'HeadingNowNormal.ttf', buffer: normalFont, description: 'Normal (10-60s)' },
      { name: 'HeadingNowExtended.ttf', buffer: extendedFont, description: 'Extended (MM:SS)' }
    ];

    for (const font of fonts) {
      const outputPath = path.join(outputDir, font.name);
      fs.writeFileSync(outputPath, Buffer.from(font.buffer));
      console.log(`✅ Generated ${font.description}: ${font.name} (${(font.buffer.byteLength / 1024).toFixed(1)} KB)`);
    }

    // Create a CSS file with font-face declarations
    const cssContent = `
/* Generated static fonts for iOS compatibility */
/* Generated automatically by scripts/generate-fonts.js */

@font-face {
  font-family: 'HeadingNowCondensed';
  src: url('/fonts/generated/HeadingNowCondensed.ttf') format('truetype');
  font-weight: 1000;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'HeadingNowNormal';
  src: url('/fonts/generated/HeadingNowNormal.ttf') format('truetype');
  font-weight: 1000;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'HeadingNowExtended';
  src: url('/fonts/generated/HeadingNowExtended.ttf') format('truetype');
  font-weight: 1000;
  font-style: normal;
  font-display: swap;
}
`;

    const cssPath = path.join(outputDir, 'fonts.css');
    fs.writeFileSync(cssPath, cssContent);
    console.log(`✅ Generated CSS file: fonts.css`);

    // Create font info JSON for reference
    const fontInfo = {
      generated: new Date().toISOString(),
      fonts: [
        {
          family: 'HeadingNowCondensed',
          file: 'HeadingNowCondensed.ttf',
          weight: 1000,
          width: 1000,
          usage: '0-9 seconds (ultra-condensed)'
        },
        {
          family: 'HeadingNowNormal',
          file: 'HeadingNowNormal.ttf',
          weight: 1000,
          width: 410,
          usage: '10-60 seconds (normal)'
        },
        {
          family: 'HeadingNowExtended',
          file: 'HeadingNowExtended.ttf',
          weight: 1000,
          width: 170,
          usage: 'MM:SS format (extended)'
        }
      ]
    };

    const infoPath = path.join(outputDir, 'font-info.json');
    fs.writeFileSync(infoPath, JSON.stringify(fontInfo, null, 2));
    console.log(`✅ Generated font info: font-info.json`);

    console.log('\n🎉 Font generation completed successfully!');
    console.log('📁 Generated files are in: public/fonts/generated/');
    console.log('\n📝 To use in your application:');
    console.log('1. Import the CSS file in your globals.css');
    console.log('2. Use the font family names in your Web Worker');
    console.log('3. iOS devices will now use static fonts with correct widths');

  } catch (error) {
    console.error('❌ Font generation failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  generateFonts();
}

module.exports = { generateFonts };