import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      // Turkish news source CDNs
      {
        protocol: 'https',
        hostname: 'trthaberstatic.cdn.wp.trt.com.tr',
      },
      {
        protocol: 'https',
        hostname: 'im.haberturk.com',
      },
      {
        protocol: 'https',
        hostname: 'image.hurimg.com',
      },
      {
        protocol: 'https',
        hostname: 'iaahbr.tmgrup.com.tr',
      },
      {
        protocol: 'https',
        hostname: 'iatkv.tmgrup.com.tr',
      },
      {
        protocol: 'https',
        hostname: 'cdn.yenisafak.com',
      },
      {
        protocol: 'https',
        hostname: 'cdnuploads.aa.com.tr',
      },
      {
        protocol: 'https',
        hostname: 'i.cnnturk.com',
      },
      {
        protocol: 'https',
        hostname: 'image.cnnturk.com',
      },
      {
        protocol: 'https',
        hostname: 'imgrosetta.mynet.com.tr',
      },
      {
        protocol: 'https',
        hostname: '*.milliyet.com.tr',
      },
      {
        protocol: 'https',
        hostname: '*.ntv.com.tr',
      },
      {
        protocol: 'https',
        hostname: '*.cumhuriyet.com.tr',
      },
      {
        protocol: 'https',
        hostname: '*.ensonhaber.com',
      },
      {
        protocol: 'https',
        hostname: '*.diken.com.tr',
      },
      {
        protocol: 'https',
        hostname: '*.odatv4.com',
      },
      {
        protocol: 'https',
        hostname: '*.webtekno.com',
      },
      {
        protocol: 'https',
        hostname: '*.shiftdelete.net',
      },
      {
        protocol: 'https',
        hostname: '*.donanimhaber.com',
      },
      {
        protocol: 'https',
        hostname: '*.bloomberght.com',
      },
      {
        protocol: 'https',
        hostname: '*.haberturk.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.tmgrup.com.tr',
      },
      {
        protocol: 'https',
        hostname: 'ichef.bbci.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'img.piri.net',
      },
      {
        protocol: 'https',
        hostname: '*.aksam.com.tr',
      },
      {
        protocol: 'https',
        hostname: 'static.dw.com',
      },
    ],
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
