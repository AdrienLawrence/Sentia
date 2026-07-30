import { invokeMock, testState } from './state.ts'

export async function createClient() {
  return {
    auth: {
      async exchangeCodeForSession(code: string) {
        return invokeMock(
          'auth',
          'exchangeCodeForSession',
          [code],
          () => ({ error: null })
        )
      },
      async updateUser(attributes: unknown) {
        return invokeMock(
          'auth',
          'updateUser',
          [attributes],
          () => ({ error: null })
        )
      },
      async resetPasswordForEmail(
        email: string,
        options: unknown
      ) {
        return invokeMock(
          'auth',
          'resetPasswordForEmail',
          [email, options],
          () => ({ error: null })
        )
      },
      async verifyOtp(options: unknown) {
        return invokeMock(
          'auth',
          'verifyOtp',
          [options],
          () => ({ error: null })
        )
      },
      async getClaims() {
        return testState.user
          ? {
              data: {
                claims: {
                  sub: testState.user.id,
                  email: testState.user.email
                }
              },
              error: null
            }
          : {
              data: null,
              error: new Error('Unauthenticated')
            }
      }
    }
  }
}
