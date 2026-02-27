import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'cdn.cloudflare.steamstatic.com' },
            { protocol: 'https', hostname: 'cdn.dota2.com' },
        ],
    },
};

export default withNextIntl(nextConfig);
