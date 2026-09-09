import { invokeMock } from './state.ts'
import {
  PRIVACY_POLICY_VERSION,
  TERMS_OF_SERVICE_VERSION
} from '../../src/features/legal/constants.ts'

const modelCache = new Map<string, object>()

function modelProxy(model: string) {
  const existing = modelCache.get(model)
  if (existing) return existing

  const proxy = new Proxy(
    {},
    {
      get(_target, operation) {
        return (...args: any[]) =>
          invokeMock(
            'prisma',
            `${model}.${String(operation)}`,
            args,
            model === 'user' && operation === 'findUnique'
              ? () => ({
                  privacy_policy_version:
                    PRIVACY_POLICY_VERSION,
                  privacy_policy_accepted_at: new Date(),
                  terms_of_service_version:
                    TERMS_OF_SERVICE_VERSION,
                  terms_of_service_accepted_at: new Date()
                })
              : model === 'deletedAccountTombstone' &&
                  operation === 'findUnique'
                ? () => null
              : undefined
          )
      }
    }
  )

  modelCache.set(model, proxy)
  return proxy
}

export const prisma = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === '$queryRaw') {
        return (...args: any[]) =>
          invokeMock(
            'prisma',
            '$queryRaw',
            args,
            () => [
              {
                count: 1,
                retry_after_seconds: 86_400
              }
            ]
          )
      }

      if (property === '$executeRaw') {
        return (...args: any[]) =>
          invokeMock(
            'prisma',
            '$executeRaw',
            args,
            () => 1
          )
      }

      if (property === '$transaction') {
        return async (operation: any, options?: any) => {
          invokeMock(
            'prisma',
            '$transaction',
            [operation, options],
            () => undefined
          )

          if (typeof operation === 'function') {
            return operation(prisma)
          }

          return Promise.all(operation)
        }
      }

      return modelProxy(String(property))
    }
  }
) as any
