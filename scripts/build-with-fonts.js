#!/usr/bin/env node

/**
 * Build Script with Font Generation
 *
 * This script generates static fonts before building the application
 * to ensure iOS compatibility with proper font widths.
 */

import { spawn } from 'child_process';
import path from 'path';

async function runCommand(command, args, description) {
  console.log(`\n🔧 ${description}...`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${description} failed with code ${code}`);
        reject(new Error(`${description} failed`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ ${description} failed:`, error);
      reject(error);
    });
  });
}

async function buildWithFonts() {
  console.log('🚀 Starting build process with font generation...\n');

  try {
    // Step 1: Generate static fonts for iOS
    await runCommand('pnpm', ['run', 'fonts:generate'], 'Generating static fonts for iOS');

    // Step 2: Build the application
    await runCommand('pnpm', ['run', 'build'], 'Building Next.js application');

    console.log('\n🎉 Build completed successfully!');
    console.log('✅ Static fonts generated for iOS compatibility');
    console.log('✅ Application built and ready for deployment');
    console.log('\n📝 What was accomplished:');
    console.log('- Generated 3 static fonts (condensed, normal, extended)');
    console.log('- Each font has proper width variations for different timer states');
    console.log('- iOS devices will now render fonts correctly');
    console.log('- Non-iOS devices continue to use variable fonts');

  } catch (error) {
    console.error('\n❌ Build process failed:', error.message);
    process.exit(1);
  }
}

// Run the build process
if (import.meta.url === `file://${process.argv[1]}`) {
  buildWithFonts();
}

export { buildWithFonts };