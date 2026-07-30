type Handler = (...args: any[]) => any

interface MockState {
  user: {
    id: string
    email: string | null
  } | null
  prisma: Record<string, Handler>
  rag: Record<string, Handler>
  openai: Record<string, Handler>
  auth: Record<string, Handler>
  calls: {
    prisma: Array<{ method: string; args: any[] }>
    rag: Array<{ method: string; args: any[] }>
    openai: Array<{ method: string; args: any[] }>
    auth: Array<{ method: string; args: any[] }>
  }
}

const DEFAULT_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'tester@example.com'
}

const stateKey = Symbol.for('sentia.test-state')
const globalState = globalThis as typeof globalThis & {
  [stateKey]?: MockState
}

export const testState: MockState =
  globalState[stateKey] ??
  ({
    user: DEFAULT_USER,
    prisma: {},
    rag: {},
    openai: {},
    auth: {},
    calls: {
      prisma: [],
      rag: [],
      openai: [],
      auth: []
    }
  } satisfies MockState)

globalState[stateKey] = testState

export function resetTestState() {
  testState.user = { ...DEFAULT_USER }
  testState.prisma = {}
  testState.rag = {}
  testState.openai = {}
  testState.auth = {}
  testState.calls.prisma = []
  testState.calls.rag = []
  testState.calls.openai = []
  testState.calls.auth = []

  const securityRuntime = (
    globalThis as typeof globalThis & {
      [key: symbol]:
        | {
            legalConsent?: Map<unknown, unknown>
            legalConsentRequests?: Map<unknown, unknown>
            readRateLimits?: Map<unknown, unknown>
          }
        | undefined
    }
  )[Symbol.for('sentia.api-security-runtime')]

  securityRuntime?.legalConsent?.clear()
  securityRuntime?.legalConsentRequests?.clear()
  securityRuntime?.readRateLimits?.clear()
}

export function invokeMock(
  group: 'prisma' | 'rag' | 'openai' | 'auth',
  method: string,
  args: any[],
  fallback?: Handler
) {
  testState.calls[group].push({ method, args })
  const handler = testState[group][method] ?? fallback

  if (!handler) {
    throw new Error(`Missing ${group} mock: ${method}`)
  }

  return handler(...args)
}
