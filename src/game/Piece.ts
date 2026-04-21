import { BOARD_COLS, BOARD_ROWS, NUM_COLORS } from './constants'

export type PuyoColor = 1 | 2 | 3 | 4 | 5

// A pair consists of a pivot puyo and a satellite puyo.
// The satellite orbits the pivot using an offset (dx, dy).
export interface PairPuyo {
  pivotColor: PuyoColor
  satColor: PuyoColor
  // pivot grid position
  px: number
  py: number
  // satellite offset: one of (0,-1),(1,0),(0,1),(-1,0)
  sdx: number
  sdy: number
}

function randColor(): PuyoColor {
  return (Math.floor(Math.random() * NUM_COLORS) + 1) as PuyoColor
}

export function newPair(): PairPuyo {
  return {
    pivotColor: randColor(),
    satColor:   randColor(),
    px: Math.floor(BOARD_COLS / 2),
    py: 1,
    sdx: 0,
    sdy: -1,
  }
}

export function rotateCW(p: PairPuyo): PairPuyo {
  // (dx, dy) -> (dy, -dx) but Puyo convention: CW = (-dy, dx)
  return { ...p, sdx: -p.sdy, sdy: p.sdx }
}

export function rotateCCW(p: PairPuyo): PairPuyo {
  return { ...p, sdx: p.sdy, sdy: -p.sdx }
}

export function satPos(p: PairPuyo): [number, number] {
  return [p.px + p.sdx, p.py + p.sdy]
}

export function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_COLS && y >= 0 && y < BOARD_ROWS
}
