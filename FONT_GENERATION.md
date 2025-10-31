# Font Generation for iOS Compatibility

This project uses a custom font generation system to ensure proper font rendering on iPhone devices where Safari doesn't support variable font width control.

## Problem

- iOS Safari doesn't support `variationSettings` for controlling font width
- Variable fonts load but fall back to default widths
- iPhone users see incorrect font widths in timer displays

## Solution

Pre-generate static fonts with specific widths using `@web-alchemy/fonttools` library during the build process.

## Generated Fonts

Three static fonts are generated from the variable font:

1. **HeadingNowCondensed.ttf** (width 1000)
   - Usage: 0-9 seconds (single digits)
   - Ultra-condensed for maximum width

2. **HeadingNowNormal.ttf** (width 410)
   - Usage: 10-60 seconds (two digits)
   - Condensed width for two-digit numbers

3. **HeadingNowExtended.ttf** (width 170)
   - Usage: MM:SS format (60+ seconds)
   - Extended width for time format with colon

## Usage

### Development

For development, the pre-generated fonts are already included in the repository. The iOS detection logic will automatically use these fonts on iPhone devices.

### Build Process

For production builds, run:

```bash
# Generate fonts and build
pnpm run build:prod

# Or step by step:
pnpm run fonts:generate  # Generate static fonts
pnpm run build           # Build application
```

### Font Generation Script

The font generation script (`scripts/generate-fonts.cjs`) uses `@web-alchemy/fonttools` to:

1. Load the variable font `HeadingNowVariable-Regular.ttf`
2. Generate three static fonts with specific widths and weight 1000
3. Save them to `public/fonts/generated/`
4. Generate CSS file with font-face declarations
5. Create font info metadata

## File Structure

```
public/fonts/
├── HeadingNowVariable-Regular.ttf    # Original variable font
└── generated/                        # Generated static fonts
    ├── HeadingNowCondensed.ttf       # Ultra-condensed (0-9s)
    ├── HeadingNowNormal.ttf          # Normal (10-60s)
    ├── HeadingNowExtended.ttf        # Extended (MM:SS)
    ├── fonts.css                     # Font-face declarations
    └── font-info.json               # Font metadata
```

## iOS Detection Logic

The application automatically detects iOS devices and:

1. **iOS**: Uses pre-generated static fonts with correct widths
2. **Non-iOS**: Uses original variable font with dynamic width control

## Implementation Details

### Client-side (`ClientTimerGenerator.tsx`)

```typescript
// iOS: Load pre-generated static fonts
if (detectIOS()) {
  const fontPromises = [
    fetch('/fonts/generated/HeadingNowCondensed.ttf'),
    fetch('/fonts/generated/HeadingNowNormal.ttf'),
    fetch('/fonts/generated/HeadingNowExtended.ttf')
  ];
  // ... load and transfer to Web Worker
}
```

### Web Worker (`timer-worker.js`)

```javascript
// iOS: Register generated static fonts
if (isIOS && generatedFonts) {
  const fontFaces = [
    new FontFace('HeadingNowCondensed', generatedFonts.condensed, {
      weight: '1000', style: 'normal', display: 'swap'
    }),
    // ... other fonts
  ];
}
```

## Benefits

1. **iOS Compatibility**: Proper font widths on iPhone devices
2. **Performance**: Static fonts load faster than variable fonts
3. **Fallback System**: Multiple fallback mechanisms ensure robustness
4. **Cross-Platform**: Works on both iOS and non-iOS devices
5. **Build-Time Generation**: No runtime dependencies for font generation

## Troubleshooting

### Fonts Not Loading on iOS

1. Check if generated fonts exist in `public/fonts/generated/`
2. Verify CSS import in `src/styles/globals.css`
3. Check browser console for font loading errors
4. Ensure iOS detection is working correctly

### Build Issues

1. Run `pnpm run fonts:generate` separately to test font generation
2. Check if `@web-alchemy/fonttools` is installed as dev dependency
3. Verify original font file exists at `public/fonts/HeadingNowVariable-Regular.ttf`

### Regenerating Fonts

If you need to update the font widths or add new variants:

1. Modify `scripts/generate-fonts.cjs`
2. Run `pnpm run fonts:generate`
3. Test the changes on iOS devices
4. Commit both the script and generated fonts

## Future Improvements

1. Add more font weight variations if needed
2. Optimize font file sizes further
3. Add font subsetting for smaller file sizes
4. Consider WOFF2 format for better compression