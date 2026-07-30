import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { createEmbeddings } from '@/lib/ai/openai'
import {
  chunkTiptapContent,
  contentHash
} from '@/lib/ai/tiptapText'

export interface RetrievedChunk {
  pageId: string
  pageTitle: string
  content: string
  similarity: number
}

export interface NotebookQuizStats {
  characterCount: number
  chunkCount: number
}

export function isRagDatabaseSetupError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    code?: unknown
    meta?: { code?: unknown }
  }
  const databaseCode = candidate.meta?.code

  return (
    candidate.code === 'P2021' ||
    (candidate.code === 'P2010' &&
      (databaseCode === '42P01' ||
        databaseCode === '42704'))
  )
}

interface ExistingChunk {
  page_id: string
  chunk_index: number
  content_hash: string
}

function vectorLiteral(embedding: number[]) {
  if (
    embedding.length !== 1536 ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('Embedding provider returned an invalid vector')
  }

  return `[${embedding.join(',')}]`
}

export async function indexOwnedNotebook(
  userId: string,
  notebookId: string
) {
  const notebook = await prisma.notebook.findFirst({
    where: {
      id: notebookId,
      user_id: userId
    },
    select: {
      id: true,
      pages: {
        where: { user_id: userId },
        orderBy: { page_number: 'asc' },
        select: {
          id: true,
          title: true,
          content: true
        }
      }
    }
  })

  if (!notebook) return false

  const existing = await prisma.$queryRaw<ExistingChunk[]>(
    Prisma.sql`
      SELECT "page_id", "chunk_index", "content_hash"
      FROM "page_chunks"
      WHERE "user_id" = ${userId}::uuid
        AND "notebook_id" = ${notebookId}::uuid
    `
  )
  const existingByPage = new Map<string, ExistingChunk[]>()

  for (const chunk of existing) {
    const pageChunks = existingByPage.get(chunk.page_id) ?? []
    pageChunks.push(chunk)
    existingByPage.set(chunk.page_id, pageChunks)
  }

  const changes: Array<{
    pageId: string
    texts: string[]
    hashes: string[]
  }> = []

  for (const page of notebook.pages) {
    const texts = chunkTiptapContent(page.content).slice(0, 100)
    const hashes = texts.map(contentHash)
    const current = (existingByPage.get(page.id) ?? []).sort(
      (left, right) => left.chunk_index - right.chunk_index
    )
    const unchanged =
      current.length === hashes.length &&
      current.every(
        (chunk, index) =>
          chunk.chunk_index === index &&
          chunk.content_hash === hashes[index]
      )

    if (!unchanged) {
      changes.push({
        pageId: page.id,
        texts,
        hashes
      })
    }
  }

  const allTexts = changes.flatMap((change) => change.texts)
  const allEmbeddings: number[][] = []

  for (let start = 0; start < allTexts.length; start += 64) {
    allEmbeddings.push(
      ...(await createEmbeddings(
        allTexts.slice(start, start + 64)
      ))
    )
  }

  let embeddingOffset = 0

  for (const change of changes) {
    const embeddings = allEmbeddings.slice(
      embeddingOffset,
      embeddingOffset + change.texts.length
    )
    embeddingOffset += change.texts.length

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(
        Prisma.sql`
          DELETE FROM "page_chunks"
          WHERE "page_id" = ${change.pageId}::uuid
            AND "user_id" = ${userId}::uuid
        `
      )

      for (
        let index = 0;
        index < change.texts.length;
        index += 1
      ) {
        const embedding = vectorLiteral(embeddings[index])

        await transaction.$executeRaw(
          Prisma.sql`
            INSERT INTO "page_chunks" (
              "user_id",
              "notebook_id",
              "page_id",
              "chunk_index",
              "content",
              "content_hash",
              "embedding"
            )
            VALUES (
              ${userId}::uuid,
              ${notebookId}::uuid,
              ${change.pageId}::uuid,
              ${index},
              ${change.texts[index]},
              ${change.hashes[index]},
              CAST(${embedding} AS extensions.vector)
            )
          `
        )
      }
    })
  }

  return true
}

export async function retrieveNotebookContext(
  userId: string,
  notebookId: string,
  query: string,
  limit = 8
) {
  const [queryEmbedding] = await createEmbeddings([query])
  const embedding = vectorLiteral(queryEmbedding)

  return prisma.$queryRaw<RetrievedChunk[]>(
    Prisma.sql`
      SELECT
        chunks."page_id" AS "pageId",
        COALESCE(pages."title", 'Untitled Page') AS "pageTitle",
        chunks."content",
        (
          1 - (
            chunks."embedding" <=>
            CAST(${embedding} AS extensions.vector)
          )
        )::double precision AS "similarity"
      FROM "page_chunks" AS chunks
      INNER JOIN "pages" AS pages
        ON pages."id" = chunks."page_id"
      WHERE chunks."user_id" = ${userId}::uuid
        AND chunks."notebook_id" = ${notebookId}::uuid
      ORDER BY chunks."embedding" <=>
        CAST(${embedding} AS extensions.vector)
      LIMIT ${limit}
    `
  )
}

export async function getNotebookQuizStats(
  userId: string,
  notebookId: string,
  pageId?: string
) {
  const pageFilter = pageId
    ? Prisma.sql`AND "page_id" = ${pageId}::uuid`
    : Prisma.empty
  const [stats] = await prisma.$queryRaw<NotebookQuizStats[]>(
    Prisma.sql`
      SELECT
        COUNT(*)::integer AS "chunkCount",
        COALESCE(SUM(LENGTH("content")), 0)::integer AS "characterCount"
      FROM "page_chunks"
      WHERE "user_id" = ${userId}::uuid
        AND "notebook_id" = ${notebookId}::uuid
        ${pageFilter}
    `
  )

  return stats ?? {
    characterCount: 0,
    chunkCount: 0
  }
}

export async function retrieveNotebookQuizContext(
  userId: string,
  notebookId: string,
  limit: number,
  pageId?: string
) {
  const pageFilter = pageId
    ? Prisma.sql`AND chunks."page_id" = ${pageId}::uuid`
    : Prisma.empty

  return prisma.$queryRaw<RetrievedChunk[]>(
    Prisma.sql`
      WITH bucketed AS (
        SELECT
          chunks."page_id" AS "pageId",
          COALESCE(pages."title", 'Untitled Page') AS "pageTitle",
          chunks."content",
          pages."page_number" AS "pageNumber",
          chunks."chunk_index" AS "chunkIndex",
          NTILE(CAST(${limit} AS integer)) OVER (
            ORDER BY
              pages."page_number",
              chunks."chunk_index",
              chunks."id"
          ) AS "bucket"
        FROM "page_chunks" AS chunks
        INNER JOIN "pages" AS pages
          ON pages."id" = chunks."page_id"
        WHERE chunks."user_id" = ${userId}::uuid
          AND chunks."notebook_id" = ${notebookId}::uuid
          ${pageFilter}
      ),
      sampled AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY "bucket"
            ORDER BY "pageNumber", "chunkIndex", "pageId"
          ) AS "sampleRank"
        FROM bucketed
      )
      SELECT
        "pageId",
        "pageTitle",
        "content",
        1::double precision AS "similarity"
      FROM sampled
      WHERE "sampleRank" = 1
      ORDER BY "bucket"
    `
  )
}

export function formatRetrievedContext(chunks: RetrievedChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        `[Source ${index + 1}: ${chunk.pageTitle}]\n${chunk.content}`
    )
    .join('\n\n')
}
