import { BOARD_COLS, BOARD_ROWS, BASE_POP_SCORE, CHAIN_POWER, COLOR_BONUS, GROUP_BONUS } from './constants'
import type { PuyoColor } from './Piece'

export type Cell = 0 | PuyoColor

export type Board = Cell[][]

export function createBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () => new Array<Cell>(BOARD_COLS).fill(0))
}

export function cloneBoard(b: Board): Board {
  return b.map(row => [...row])
}

// Returns true if the cell is occupied or out of bounds
export function isBlocked(b: Board, x: number, y: number): boolean {
  if (x < 0 || x >= BOARD_COLS) return true
  if (y >= BOARD_ROWS) return true
  if (y < 0) return false
  return b[y][x] !== 0
}

// Place a puyo, returns new board
export function place(b: Board, x: number, y: number, color: Cell): Board {
  const nb = cloneBoard(b)
  if (y >= 0) nb[y][x] = color
  return nb
}

// Apply gravity: drop all floating puyos
export function applyGravity(b: Board): Board {
  const nb = cloneBoard(b)
  for (let x = 0; x < BOARD_COLS; x++) {
    let writeY = BOARD_ROWS - 1
    for (let y = BOARD_ROWS - 1; y >= 0; y--) {
      if (nb[y][x] !== 0) {
        nb[writeY][x] = nb[y][x]
        if (writeY !== y) nb[y][x] = 0
        writeY--
      }
    }
  }
  return nb
}

export interface PopResult {
  board: Board
  poppedCells: [number, number][]
  score: number
}

// Find connected groups, pop groups of 4+, return score for one chain step
export function popGroups(b: Board, chainIndex: number): PopResult | null {
  const visited = Array.from({ length: BOARD_ROWS }, () => new Array<boolean>(BOARD_COLS).fill(false))
  const groups: [number, number][][] = []

  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      if (b[y][x] !== 0 && !visited[y][x]) {
        const color = b[y][x]
        const group: [number, number][] = []
        const stack: [number, number][] = [[x, y]]
        while (stack.length) {
          const [cx, cy] = stack.pop()!
          if (cx < 0 || cx >= BOARD_COLS || cy < 0 || cy >= BOARD_ROWS) continue
          if (visited[cy][cx] || b[cy][cx] !== color) continue
          visited[cy][cx] = true
          group.push([cx, cy])
          stack.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1])
        }
        if (group.length >= 4) groups.push(group)
      }
    }
  }

  if (groups.length === 0) return null

  const poppedCells: [number, number][] = groups.flat()
  const nb = cloneBoard(b)
  for (const [px, py] of poppedCells) nb[py][px] = 0

  // Score calculation
  const chainPower = CHAIN_POWER[Math.min(chainIndex, CHAIN_POWER.length - 1)]
  const colors = new Set(groups.map(g => b[g[0][1]][g[0][0]]))
  const colorBonus = COLOR_BONUS[Math.min(colors.size - 1, COLOR_BONUS.length - 1)]
  let groupBonus = 0
  for (const g of groups) groupBonus += GROUP_BONUS[Math.min(g.length, GROUP_BONUS.length - 1)]
  const multiplier = Math.max(1, chainPower + colorBonus + groupBonus)
  const score = BASE_POP_SCORE * poppedCells.length * multiplier

  return { board: nb, poppedCells, score }
}

// Check if game over: column 3 (center) row 1 blocked
export function isGameOver(b: Board): boolean {
  return b[1][2] !== 0 || b[1][3] !== 0
}
