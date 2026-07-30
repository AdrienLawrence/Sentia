export const USER_ID =
  '11111111-1111-4111-8111-111111111111'
export const OTHER_USER_ID =
  '22222222-2222-4222-8222-222222222222'
export const NOTEBOOK_ID =
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const PAGE_ID =
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const SECOND_PAGE_ID =
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

export function jsonRequest(
  path: string,
  method: string,
  body?: unknown,
  origin = 'http://localhost'
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: origin
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

export async function responseJson(response: Response) {
  return (await response.json()) as Record<string, any>
}
