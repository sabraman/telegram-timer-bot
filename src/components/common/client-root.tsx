"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import Loader from "./loader";
import { ThemeProvider } from "./theme-provider";

// Dynamically import the Root component with ssr: false
const DynamicRoot = dynamic(() => import("./root"), {
  ssr: false,
  loading: () => <Loader />,
});

// Create Convex client only if URL is available
const convex = process.env.NEXT_PUBLIC_CONVEX_URL
  ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  : null;

// Client wrapper component that can be imported in layout.tsx
export function ClientRoot({
  children,
  debug = false,
}: {
  children: ReactNode;
  debug?: boolean;
}) {
  // If no Convex URL, render without ConvexProvider (for build time)
  if (!convex) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <DynamicRoot debug={debug}>{children}</DynamicRoot>
      </ThemeProvider>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <DynamicRoot debug={debug}>{children}</DynamicRoot>
      </ThemeProvider>
    </ConvexProvider>
  );
}
