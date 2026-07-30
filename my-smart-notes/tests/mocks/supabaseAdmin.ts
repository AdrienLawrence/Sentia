import { invokeMock } from './state.ts'

export function createAdminClient() {
  return {
    auth: {
      admin: {
        async deleteUser(userId: string) {
          return invokeMock(
            'auth',
            'deleteUser',
            [userId],
            () => ({ error: null })
          )
        }
      }
    }
  }
}
