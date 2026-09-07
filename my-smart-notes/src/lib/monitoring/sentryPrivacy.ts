import type { ErrorEvent } from "@sentry/nextjs";

type SentryInitOptions = Parameters<
  typeof import("@sentry/nextjs").init
>[0];
type TransactionEvent = Parameters<
  NonNullable<SentryInitOptions["beforeSendTransaction"]>
>[0];

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key"
]);

const URL_DATA_KEYS = new Set([
  "from",
  "to",
  "url",
  "url.full",
  "http.url",
  "http.request.url"
]);

const QUERY_DATA_KEYS = new Set([
  "query_string",
  "url.query",
  "http.query"
]);

function stripQueryAndFragment(value: string) {
  const queryIndex = value.indexOf("?");
  const fragmentIndex = value.indexOf("#");
  const indexes = [queryIndex, fragmentIndex].filter(
    (index) => index >= 0
  );

  return indexes.length > 0
    ? value.slice(0, Math.min(...indexes))
    : value;
}

function sanitizeUrlData(data: Record<string, unknown>) {
  for (const key of QUERY_DATA_KEYS) delete data[key];

  for (const key of URL_DATA_KEYS) {
    if (typeof data[key] === "string") {
      data[key] = stripQueryAndFragment(data[key]);
    }
  }
}

function sanitizeCommonEvent<T extends ErrorEvent | TransactionEvent>(
  event: T
): T {
  delete event.user;

  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;

    if (event.request.url) {
      event.request.url = stripQueryAndFragment(event.request.url);
    }

    if (event.request.headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(event.request.headers).filter(
          ([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase())
        )
      );
    }
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.data) sanitizeUrlData(breadcrumb.data);
  }

  for (const span of event.spans ?? []) {
    sanitizeUrlData(span.data);
  }

  if (event.transaction) {
    event.transaction = stripQueryAndFragment(event.transaction);
  }

  return event;
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  return sanitizeCommonEvent(event);
}

export function sanitizeSentryTransaction(
  event: TransactionEvent
): TransactionEvent {
  return sanitizeCommonEvent(event);
}
