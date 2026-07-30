import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(testsDirectory, '..')

const mockModules = new Map([
  [
    '@/lib/prisma',
    resolve(testsDirectory, 'mocks', 'prisma.ts')
  ],
  [
    '@/lib/supabase/server',
    resolve(testsDirectory, 'mocks', 'supabaseServer.ts')
  ],
  [
    '@/lib/supabase/admin',
    resolve(testsDirectory, 'mocks', 'supabaseAdmin.ts')
  ],
  [
    '@/lib/ai/rag',
    resolve(testsDirectory, 'mocks', 'rag.ts')
  ],
  [
    '@/lib/ai/openai',
    resolve(testsDirectory, 'mocks', 'openai.ts')
  ]
])

function resolveProjectModule(specifier) {
  const basePath = resolve(
    projectDirectory,
    'src',
    specifier.slice(2)
  )

  if (extname(basePath)) return basePath

  for (const extension of ['.ts', '.tsx']) {
    const candidate = `${basePath}${extension}`
    if (existsSync(candidate)) return candidate
  }

  return basePath
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context)
    }

    const mockPath = mockModules.get(specifier)

    if (mockPath) {
      return {
        shortCircuit: true,
        url: pathToFileURL(mockPath).href
      }
    }

    if (specifier.startsWith('@/')) {
      return {
        shortCircuit: true,
        url: pathToFileURL(
          resolveProjectModule(specifier)
        ).href
      }
    }

    if (
      specifier.startsWith('.') &&
      !extname(specifier) &&
      context.parentURL?.startsWith('file:')
    ) {
      const parentDirectory = dirname(
        fileURLToPath(context.parentURL)
      )
      const basePath = resolve(parentDirectory, specifier)

      for (const extension of ['.ts', '.tsx']) {
        const candidate = `${basePath}${extension}`

        if (existsSync(candidate)) {
          return {
            shortCircuit: true,
            url: pathToFileURL(candidate).href
          }
        }
      }
    }

    return nextResolve(specifier, context)
  }
})
