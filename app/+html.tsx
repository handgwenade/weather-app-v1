import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <title>RoadSignal</title>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="application-name" content="RoadSignal" />
        <meta name="apple-mobile-web-app-title" content="RoadSignal" />
        <meta name="theme-color" content="#2F7FD8" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
