import { PrelContext } from './kza-prel.ts'
import { listAdapters, StorageAdapter } from './storage-adapter.ts'

export interface PlacementDecision {
  providerType: string
  chunkIndex: number
  estimatedSize: number
}

interface ProviderScore {
  adapter: StorageAdapter
  score: number
  lastChunkIndex: number
  consecutiveCount: number
}

const MAX_CONSECUTIVE = 2

const SPEED_TIERS: Record<string, number> = {
  github: 0.9,
  file_io: 0.7,
  paste_c_net: 0.6,
  paste_rs: 0.6,
  ipfs: 0.4,
  usenet: 0.2,
}

const RELIABILITY: Record<string, number> = {
  github: 0.95,
  file_io: 0.7,
  paste_c_net: 0.5,
  paste_rs: 0.4,
  ipfs: 0.3,
  usenet: 0.1,
}

function weigh(adapters: StorageAdapter[], fileSize: number, chunkSize: number): ProviderScore[] {
  const scores: ProviderScore[] = []

  for (const adapter of adapters) {
    const maxBlob = adapter.maxBlobSize()
    let blobFit = 1.0
    if (chunkSize > maxBlob) blobFit = 0

    const type = adapter.providerType
    const speed = SPEED_TIERS[type] ?? 0.5
    const reliability = RELIABILITY[type] ?? 0.3

    const capacity = Math.min(1, maxBlob / (fileSize + 1))
    const geographic = type === 'usenet' ? 0.9 : type === 'ipfs' ? 0.8 : 0.5

    const score = capacity * 0.30 + reliability * 0.25 + speed * 0.20 + geographic * 0.15 + blobFit * 0.10

    scores.push({
      adapter,
      score,
      lastChunkIndex: -1,
      consecutiveCount: 0,
    })
  }

  return scores
}

function weightedRandomPick(scores: ProviderScore[], chunkIndex: number): ProviderScore {
  const eligible = scores.filter(s => s.consecutiveCount < MAX_CONSECUTIVE)
  const pool = eligible.length > 0 ? eligible : scores

  const totalScore = pool.reduce((sum, s) => sum + s.score, 0)
  let roll = Math.random() * totalScore

  for (const ps of pool) {
    roll -= ps.score
    if (roll <= 0) return ps
  }

  return pool[pool.length - 1]
}

export function planPlacement(
  ctx: PrelContext,
  totalChunks: number,
  totalSize: number,
  chunkSize: number,
): PlacementDecision[] {
  const adapters = listAdapters()
  if (adapters.length === 0) throw new Error('no storage adapters registered')

  const scores = weigh(adapters, totalSize, chunkSize)
  const decisions: PlacementDecision[] = []

  for (let i = 0; i < totalChunks; i++) {
    const pick = weightedRandomPick(scores, i)
    decisions.push({
      chunkIndex: i,
      providerType: pick.adapter.providerType,
      estimatedSize: Math.min(chunkSize, pick.adapter.maxBlobSize()),
    })

    pick.lastChunkIndex = i
    pick.consecutiveCount = (pick.lastChunkIndex === i - 1) ? pick.consecutiveCount + 1 : 1
  }

  return decisions
}
