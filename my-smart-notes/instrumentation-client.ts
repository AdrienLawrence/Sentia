import * as Sentry from "@sentry/nextjs";
import {
  sanitizeSentryEvent,
  sanitizeSentryTransaction
} from "./src/lib/monitoring/sentryPrivacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  beforeSend: sanitizeSentryEvent,
  beforeSendTransaction: sanitizeSentryTransaction
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
