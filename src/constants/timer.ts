/**
 * Timer-related constants for Telegram Timer Bot
 * Extracted magic numbers for maintainability and consistency
 */

// ===================================
// Canvas & Display Constants
// ===================================

export const CANVAS_SIZE = 512;
export const CANVAS_WIDTH = CANVAS_SIZE;
export const CANVAS_HEIGHT = CANVAS_SIZE;

// ===================================
// Timer Performance Constants
// ===================================

export const TIMER_FPS = 1;
export const FRAME_DURATION_MS = 1000; // 1 second per frame for 1fps
export const RECORDING_FPS = 30; // Higher fps for smooth MediaRecorder recording

// ===================================
// Video Encoding Constants
// ===================================

export const BITRATE = 500000; // 500kbps for Telegram sticker optimization
export const TELEGRAM_MAX_FILE_SIZE_MB = 50;
export const TELEGRAM_MAX_FILE_SIZE_BYTES = TELEGRAM_MAX_FILE_SIZE_MB * 1024 * 1024;

// ===================================
// Video Format Constants
// ===================================

export const VIDEO_MIME_TYPE = 'video/webm;codecs=vp9';
export const VIDEO_CONTAINER_TYPE = 'video/webm';
export const VP9_CODEC = 'vp09.00.31.08'; // VP9 with alpha support for Telegram
export const LEGACY_VP9_CODEC = 'vp09.00.10.08';

// ===================================
// Font & Typography Constants
// ===================================

export const FONT_BASE_SIZE = 670; // Base font size for timer text
export const FONT_WEIGHT_HEAVY = '1000';

// Variable font width settings for different timer states
export const FONT_WIDTH_ULTRA_CONDENSED = '1000'; // For 0-9 seconds (single digit)
export const FONT_WIDTH_CONDENSED = '410'; // For 10-59 seconds (two digits)
export const FONT_WIDTH_EXTENDED = '170'; // For 60+ seconds (MM:SS format)

export const FONT_VARIATION_SINGLE_DIGIT = `'wght' ${FONT_WEIGHT_HEAVY}, 'wdth' ${FONT_WIDTH_ULTRA_CONDENSED}`;
export const FONT_VARIATION_TWO_DIGIT = `'wght' ${FONT_WEIGHT_HEAVY}, 'wdth' ${FONT_WIDTH_CONDENSED}`;
export const FONT_VARIATION_MM_SS = `'wght' ${FONT_WEIGHT_HEAVY}, 'wdth' ${FONT_WIDTH_EXTENDED}`;

// ===================================
// Timer Format Thresholds
// ===================================

export const SINGLE_DIGIT_MAX = 9; // 0-9 seconds use single digit format
export const TWO_DIGIT_MIN = 10; // 10-59 seconds use two digit format
export const MM_SS_THRESHOLD = 60; // 60+ seconds use MM:SS format

// ===================================
// File Naming Constants
// ===================================

export const DEFAULT_TIMER_FILENAME = 'timer-countdown.webm';
export const TIMER_FILE_EXTENSION = '.webm';

// ===================================
// Platform Detection Constants
// ===================================

export const IOS_DESKTOP_USER_AGENT = /iPhone|iPad/;
export const WEBKIT_USER_AGENT = 'AppleWebKit';
export const CHROME_USER_AGENT = 'Chrome';

// ===================================
// Legacy API Constants (for generate-timer route)
// ===================================

export const LEGACY_FPS = 30; // Remotion API default
export const LEGACY_DURATION_FRAMES = 60 * 30; // 60 seconds at 30fps

// ===================================
// Mediabunny Constants
// ===================================

export const MEDIABUNNY_CODEC = 'vp9';
export const MEDIABUNNY_BITRATE = BITRATE;
export const MEDIABUNNY_ALPHA = 'keep'; // Preserve transparency

// ===================================
// Cache Constants
// ===================================

export const FRAME_CACHE_KEY_PREFIX = 'frame_';
export const LEGACY_CACHE_KEY_PREFIX = 'timer_';

// ===================================
// Development Constants
// ===================================

export const DEV_MEMORY_SIZE = 8192; // Node.js memory size for development

// ===================================
// HTTP Status Code Constants
// ===================================

export const HTTP_STATUS_BAD_REQUEST = 400;
export const HTTP_STATUS_UNAUTHORIZED = 401;
export const HTTP_STATUS_REQUEST_ENTITY_TOO_LARGE = 413;
export const HTTP_STATUS_BAD_GATEWAY = 502;
export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// ===================================
// Conversion Constants
// ===================================

export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 * 1024;