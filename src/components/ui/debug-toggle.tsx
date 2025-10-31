"use client";

import { useState, useEffect } from "react";

export function DebugToggle() {
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    // Check current URL for debug mode
    const isDebugMode = typeof window !== 'undefined' && window.location.search.includes('debug=true');
    setDebugMode(isDebugMode);
  }, []);

  const toggleDebugMode = () => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (debugMode) {
      url.searchParams.delete('debug');
    } else {
      url.searchParams.set('debug', 'true');
    }

    window.location.href = url.toString();
  };

  // Only show in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!isDevelopment) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={toggleDebugMode}
        className={`px-3 py-2 rounded-lg text-xs font-mono transition-all ${
          debugMode
            ? 'bg-green-500 text-white shadow-lg'
            : 'bg-gray-600 text-white shadow hover:bg-gray-700'
        }`}
        title={debugMode ? "Debug Mode ON" : "Debug Mode OFF (Click to enable)"}
      >
        {debugMode ? '🐛 DEBUG ON' : '🐛 DEBUG OFF'}
      </button>

      {debugMode && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-black/90 text-green-400 p-3 rounded-lg text-xs font-mono">
          <div className="font-bold mb-2">Debug Mode Active</div>
          <div className="space-y-1">
            <div>• Device detection enabled</div>
            <div>• Verbose font logging</div>
            <div>• WebKit debugging active</div>
            <div>• Performance monitoring</div>
          </div>
          <div className="mt-2 text-gray-400">Check browser console for detailed logs</div>
        </div>
      )}
    </div>
  );
}