export const BOARD_COLS = 6
export const BOARD_ROWS = 13  // 12 visible + 1 hidden spawn row
export const VISIBLE_ROWS = 12
export const CELL = 54
export const BOARD_BORDER = 3

export const NUM_COLORS = 5

// Color palette with neon-glass aesthetics
export const PUYO_COLORS: Record<number, { fill: string; glow: string; shadow: string }> = {
  1: { fill: '#ff4d6d', glow: '#ff0040',  shadow: '#7a001f' }, // Red
  2: { fill: '#4cc9f0', glow: '#00b4d8',  shadow: '#003f5c' }, // Cyan
  3: { fill: '#7bed9f', glow: '#2ed573',  shadow: '#006b35' }, // Green
  4: { fill: '#ffd60a', glow: '#ffc300',  shadow: '#7a5e00' }, // Yellow
  5: { fill: '#c77dff', glow: '#9d4edd',  shadow: '#4a0090' }, // Purple
}

export const DROP_INTERVAL_MS = 700
export const SOFT_DROP_MS     = 60
export const LOCK_DELAY_MS    = 400
export const FLASH_FRAMES     = 30
export const POP_FRAMES       = 20
export const FALL_FRAMES      = 8

// Scoring
export const BASE_POP_SCORE   = 10
export const CHAIN_POWER      = [0,8,16,32,64,96,128,160,192,224,256,512]
export const COLOR_BONUS      = [0,3,6,12,24]
export const GROUP_BONUS      = [0,0,0,0,0,2,3,4,5,6,7,10]
export const LEVEL_CLEAR      = 30  // score to advance level
