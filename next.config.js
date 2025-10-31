/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
	serverExternalPackages: ["grammy"],
	experimental: {
		reactCompiler: true,
	},

	// Allow localtunnel origins for development (wildcard for all subdomains)
	allowedDevOrigins: ["https://telegram-timer-bot-228.loca.lt", "https://*.loca.lt"],

	// Allow localtunnel access for development
	async rewrites() {
		return [
			{
				source: '/:path*',
				has: [
					{
						type: 'header',
						key: 'origin',
						value: 'https://telegram-timer-bot-228.loca.lt',
					},
				],
				destination: '/:path*',
			},
		];
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},

	// Optimize images
	images: {
		formats: ['image/webp', 'image/avif'],
		dangerouslyAllowSVG: true,
		contentDispositionType: 'attachment',
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
	},

	// Configure headers for static assets
	async headers() {
		return [
			{
				source: '/fonts/:path*',
				headers: [
					{
						key: 'Cache-Control',
						value: 'public, max-age=31536000, immutable',
					},
				],
			},
			{
				source: '/audio/:path*',
				headers: [
					{
						key: 'Cache-Control',
						value: 'public, max-age=31536000, immutable',
					},
				],
			},
			{
				source: '/timer-worker.js',
				headers: [
					{
						key: 'Cache-Control',
						value: process.env.NODE_ENV === 'development' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable',
					},
					{
						key: 'Content-Type',
						value: 'application/javascript',
					},
				],
			},
		];
	},

	// Webpack configuration for optimization
	webpack: (config, { isServer }) => {
		// Optimize chunks for better caching
		if (!isServer) {
			config.optimization.splitChunks = {
				chunks: 'all',
				cacheGroups: {
					vendor: {
						test: /[\\/]node_modules[\\/]/,
						name: 'vendors',
						chunks: 'all',
					},
					common: {
						name: 'common',
						minChunks: 2,
						chunks: 'all',
						enforce: true,
					},
				},
			};
		}

		return config;
	},

	// Production optimizations
	poweredByHeader: false,
	generateEtags: true,

	// Compression
	compress: true,

	// Output configuration
	output: 'standalone',
};

export default config;
