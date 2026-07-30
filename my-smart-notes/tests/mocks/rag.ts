import { invokeMock } from './state.ts'

export function indexOwnedNotebook(...args: any[]) {
  return invokeMock(
    'rag',
    'indexOwnedNotebook',
    args,
    () => true
  )
}

export function retrieveNotebookContext(...args: any[]) {
  return invokeMock(
    'rag',
    'retrieveNotebookContext',
    args,
    () => []
  )
}

export function getNotebookQuizStats(...args: any[]) {
  return invokeMock(
    'rag',
    'getNotebookQuizStats',
    args,
    () => ({ characterCount: 4000, chunkCount: 2 })
  )
}

export function retrieveNotebookQuizContext(...args: any[]) {
  return invokeMock(
    'rag',
    'retrieveNotebookQuizContext',
    args,
    () => []
  )
}

export function isRagDatabaseSetupError(...args: any[]) {
  return invokeMock(
    'rag',
    'isRagDatabaseSetupError',
    args,
    () => false
  )
}

export function formatRetrievedContext() {
  throw new Error(
    'AI routes should serialize structured source data'
  )
}
