import {
  DROP_INTERVAL_MS, SOFT_DROP_MS, LOCK_DELAY_MS,
  FLASH_FRAMES, POP_FRAMES, LEVEL_CLEAR
} from './constants'
import {
  createBoard, isBlocked, place, applyGravity, popGroups, isGameOver,
  type Board, type PopResult
} from './Board'
import {
  newPair, rotateCW, rotateCCW, satPos, isInsideBoard,
  type PairPuyo
} from './Piece'

export type GamePhase =
  | 'falling'   // pair is dropping
  | 'locking'   // pair landed, brief delay
  | 'popping'   // flash animation before pop
  | 'dropping'  // gravity after pop
  | 'gameover'

export interface AnimState {
  phase: GamePhase
  poppedCells: [number, number][]
  flashFrame: number
  popFrame: number
  fallFrame: number
  chainIndex: number
}

export interface GameState {
  board: Board
  current: PairPuyo
  next: PairPuyo
  score: number
  highScore: number
  level: number
  chain: number
  maxChain: number
  totalPopped: number
  anim: AnimState
  dropTimer: number
  lockTimer: number
}

function initialAnim(): AnimState {
  return {
    phase: 'falling',
    poppedCells: [],
    flashFrame: 0,
    popFrame: 0,
    fallFrame: 0,
    chainIndex: 0,
  }
}

export function createGame(highScore = 0): GameState {
  return {
    board: createBoard(),
    current: newPair(),
    next: newPair(),
    score: 0,
    highScore,
    level: 1,
    chain: 0,
    maxChain: 0,
    totalPopped: 0,
    anim: initialAnim(),
    dropTimer: 0,
    lockTimer: 0,
  }
}

// ── Collision helpers ──────────────────────────────────────────────────────

function canPlace(board: Board, p: PairPuyo, dx = 0, dy = 0): boolean {
  const nx = p.px + dx
  const ny = p.py + dy
  if (!isInsideBoard(nx, ny) || isBlocked(board, nx, ny)) return false
  const [sx, sy] = satPos(p)
  const nsx = sx + dx
  const nsy = sy + dy
  if (!isInsideBoard(nsx, nsy) || isBlocked(board, nsx, nsy)) return false
  return true
}

// Returns the position the current pair would land at if hard-dropped
export function ghostPosition(board: Board, current: PairPuyo): PairPuyo {
  let p = current
  while (canPlace(board, p, 0, 1)) p = { ...p, py: p.py + 1 }
  return p
}

// ── Public actions (return new state) ──────────────────────────────────────

export function moveLeft(gs: GameState): GameState {
  if (gs.anim.phase !== 'falling' && gs.anim.phase !== 'locking') return gs
  if (!canPlace(gs.board, gs.current, -1, 0)) return gs
  return { ...gs, current: { ...gs.current, px: gs.current.px - 1 }, lockTimer: 0 }
}

export function moveRight(gs: GameState): GameState {
  if (gs.anim.phase !== 'falling' && gs.anim.phase !== 'locking') return gs
  if (!canPlace(gs.board, gs.current, 1, 0)) return gs
  return { ...gs, current: { ...gs.current, px: gs.current.px + 1 }, lockTimer: 0 }
}

export function rotatePairCW(gs: GameState): GameState {
  if (gs.anim.phase !== 'falling' && gs.anim.phase !== 'locking') return gs
  let rotated = rotateCW(gs.current)
  if (!canPlace(gs.board, rotated)) {
    // Wall kick: try nudge left or right
    if (canPlace(gs.board, { ...rotated, px: rotated.px + 1 })) rotated = { ...rotated, px: rotated.px + 1 }
    else if (canPlace(gs.board, { ...rotated, px: rotated.px - 1 })) rotated = { ...rotated, px: rotated.px - 1 }
    else return gs
  }
  return { ...gs, current: rotated, lockTimer: 0 }
}

export function rotatePairCCW(gs: GameState): GameState {
  if (gs.anim.phase !== 'falling' && gs.anim.phase !== 'locking') return gs
  let rotated = rotateCCW(gs.current)
  if (!canPlace(gs.board, rotated)) {
    if (canPlace(gs.board, { ...rotated, px: rotated.px + 1 })) rotated = { ...rotated, px: rotated.px + 1 }
    else if (canPlace(gs.board, { ...rotated, px: rotated.px - 1 })) rotated = { ...rotated, px: rotated.px - 1 }
    else return gs
  }
  return { ...gs, current: rotated, lockTimer: 0 }
}

function lockPair(gs: GameState): GameState {
  const [sx, sy] = satPos(gs.current)
  let board = gs.board

  // Place both puyos then gravity
  const fy1 = landingY(board, gs.current.px, gs.current.py)
  board = place(board, gs.current.px, fy1, gs.current.pivotColor)
  const fy2 = landingY(board, sx, sy > gs.current.py ? gs.current.py : sy)
  board = place(board, sx, fy2, gs.current.satColor)
  board = applyGravity(board)

  if (isGameOver(board)) {
    return { ...gs, board, anim: { ...initialAnim(), phase: 'gameover' } }
  }

  return startChain({ ...gs, board, anim: { ...initialAnim(), phase: 'popping', chainIndex: 0 } })
}

function landingY(board: Board, x: number, startY: number): number {
  let y = startY
  while (y + 1 < board.length && board[y + 1][x] === 0) y++
  return y
}

function startChain(gs: GameState): GameState {
  const result: PopResult | null = popGroups(gs.board, gs.anim.chainIndex)
  if (!result) {
    // No more pops — chain ended
    const currentPair = gs.next
    const next = newPair()
    const maxChain = Math.max(gs.maxChain, gs.chain)
    if (!canPlace(gs.board, currentPair)) {
      return { ...gs, chain: 0, maxChain, anim: { ...initialAnim(), phase: 'gameover' } }
    }
    return {
      ...gs,
      current: currentPair,
      next,
      chain: 0,
      maxChain,
      anim: initialAnim(),
      dropTimer: 0,
    }
  }

  const chain = gs.anim.chainIndex + 1
  const score = gs.score + result.score
  const highScore = Math.max(gs.highScore, score)
  const totalPopped = gs.totalPopped + result.poppedCells.length
  const level = Math.floor(totalPopped / LEVEL_CLEAR) + 1

  return {
    ...gs,
    board: result.board,
    score,
    highScore,
    chain,
    totalPopped,
    level,
    anim: {
      ...gs.anim,
      phase: 'popping',
      poppedCells: result.poppedCells,
      flashFrame: FLASH_FRAMES,
      popFrame: POP_FRAMES,
      chainIndex: gs.anim.chainIndex + 1,
    },
  }
}

// ── Main tick ──────────────────────────────────────────────────────────────

export function tick(gs: GameState, dtMs: number, softDrop: boolean): GameState {
  const { anim } = gs

  if (anim.phase === 'gameover') return gs

  if (anim.phase === 'popping') {
    if (anim.flashFrame > 0) return { ...gs, anim: { ...anim, flashFrame: anim.flashFrame - 1 } }
    if (anim.popFrame > 0)   return { ...gs, anim: { ...anim, popFrame: anim.popFrame - 1 } }
    // Gravity then check for more pops
    const dropped = applyGravity(gs.board)
    return startChain({ ...gs, board: dropped, anim: { ...anim, phase: 'dropping' } })
  }

  if (anim.phase === 'dropping') return gs // handled above

  // Falling / locking
  const interval = softDrop ? SOFT_DROP_MS : Math.max(100, DROP_INTERVAL_MS - (gs.level - 1) * 50)
  const newTimer = gs.dropTimer + dtMs

  if (newTimer < interval) return { ...gs, dropTimer: newTimer }

  // Try to drop
  if (canPlace(gs.board, gs.current, 0, 1)) {
    return {
      ...gs,
      current: { ...gs.current, py: gs.current.py + 1 },
      dropTimer: 0,
      anim: { ...anim, phase: 'falling' },
    }
  }

  // Landed — enter lock delay
  if (anim.phase === 'falling') {
    return { ...gs, dropTimer: 0, lockTimer: 0, anim: { ...anim, phase: 'locking' } }
  }

  // Lock delay elapsed
  const newLock = gs.lockTimer + dtMs
  if (newLock < LOCK_DELAY_MS) return { ...gs, lockTimer: newLock, dropTimer: 0 }

  return lockPair({ ...gs, lockTimer: 0 })
}

export function hardDrop(gs: GameState): GameState {
  if (gs.anim.phase !== 'falling' && gs.anim.phase !== 'locking') return gs
  let p = gs.current
  while (canPlace(gs.board, p, 0, 1)) p = { ...p, py: p.py + 1 }
  return lockPair({ ...gs, current: p, lockTimer: LOCK_DELAY_MS })
}
