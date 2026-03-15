import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'ポモドーロタイマー - 無料の集中タイマー',
  description:
    '無料のポモドーロタイマー。25分の集中と5分の休憩で生産性を最大化。作業時間の記録・グラフ表示、PiP対応。インストール不要でブラウザですぐ使えます。',
  keywords:
    'ポモドーロタイマー,ポモドーロ・テクニック,集中タイマー,作業用タイマー,無料タイマー,生産性向上,時間管理',
  metadataBase: new URL('https://yuhi-sa.github.io/pomodoro/'),
  alternates: {
    canonical: 'https://yuhi-sa.github.io/pomodoro/',
    languages: {
      ja: 'https://yuhi-sa.github.io/pomodoro/',
      'x-default': 'https://yuhi-sa.github.io/pomodoro/',
    },
  },
  openGraph: {
    type: 'website',
    title: 'ポモドーロタイマー - 無料の集中タイマー',
    description:
      '無料のポモドーロタイマー。作業時間の記録・グラフ表示、PiP対応。インストール不要でブラウザですぐ使えます。',
    url: 'https://yuhi-sa.github.io/pomodoro/',
    siteName: 'ポモドーロタイマー',
    locale: 'ja_JP',
    images: [
      {
        url: 'https://yuhi-sa.github.io/pomodoro/ogp.jpeg',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'ポモドーロタイマー - 無料の集中タイマー',
    description:
      '無料のポモドーロタイマー。作業時間の記録・グラフ表示、PiP対応。ブラウザですぐ使えます。',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍅</text></svg>",
  },
  other: {
    'theme-color': '#e74c3c',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LN6QP6VVM3"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LN6QP6VVM3');
          `}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'ポモドーロタイマー',
              description:
                '無料のポモドーロタイマー。25分の集中と5分の休憩で生産性を最大化。作業時間の記録・グラフ表示、PiP対応。',
              url: 'https://yuhi-sa.github.io/pomodoro/',
              applicationCategory: 'ProductivityApplication',
              operatingSystem: 'Any',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'JPY',
              },
            }),
          }}
        />
      </head>
      <body className="font-sans bg-[#0f0f1a] text-[#e8e8ec] min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
