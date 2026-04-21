import { BOARD_COLS, VISIBLE_ROWS, CELL, BOARD_BORDER, PUYO_COLORS, BOARD_ROWS } from '../game/constants'
import { satPos } from '../game/Piece'
import { ghostPosition } from '../game/GameEngine'
import type { GameState } from '../game/GameEngine'
import type { Cell } from '../game/Board'
import type { Board } from '../game/Board'

const RADIUS = CELL * 0.42

export class Renderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private nextCanvas: HTMLCanvasElement
  private nextCtx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private floatingTexts: FloatingText[] = []

  constructor(canvas: HTMLCanvasElement, nextCanvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.nextCanvas = nextCanvas
    this.nextCtx = nextCanvas.getContext('2d')!

    canvas.width  = BOARD_COLS * CELL + BOARD_BORDER * 2
    canvas.height = VISIBLE_ROWS * CELL + BOARD_BORDER * 2
    nextCanvas.width  = 3 * CELL
    nextCanvas.height = 3 * CELL
  }

  render(gs: GameState): void {
    this.drawBoard(gs)
    this.drawNext(gs)
    this.updateParticles()
    this.drawFloatingTexts()
  }

  spawnParticles(cells: [number, number][], board: GameState['board']): void {
    for (const [cx, cy] of cells) {
      const visY = cy - (BOARD_ROWS - VISIBLE_ROWS - 1)
      if (visY < 0) continue
      const color = (board[cy][cx] ?? 1) as 1 | 2 | 3 | 4 | 5
      const palette = PUYO_COLORS[color]
      const px = BOARD_BORDER + cx * CELL + CELL / 2
      const py = BOARD_BORDER + visY * CELL + CELL / 2
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 3
        this.particles.push({
          x: px, y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 1,
          decay: 0.04 + Math.random() * 0.04,
          color: palette.fill,
          size: 2 + Math.random() * 4,
        })
      }
    }
  }

  spawnFloatingText(x: number, y: number, text: string): void {
    this.floatingTexts.push({ x, y, vy: -1.2, text, alpha: 1, scale: 0.6 })
  }

  private drawBoard(gs: GameState): void {
    const { ctx, canvas } = this
    const { board, current, anim } = gs
    const offsetRow = BOARD_ROWS - VISIBLE_ROWS - 1

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
    grad.addColorStop(0, '#0a0a1a')
    grad.addColorStop(1, '#050510')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid lines
    ctx.strokeStyle = 'rgba(100,120,255,0.06)'
    ctx.lineWidth = 1
    for (let x = 0; x <= BOARD_COLS; x++) {
      ctx.beginPath()
      ctx.moveTo(BOARD_BORDER + x * CELL, BOARD_BORDER)
      ctx.lineTo(BOARD_BORDER + x * CELL, canvas.height - BOARD_BORDER)
      ctx.stroke()
    }
    for (let y = 0; y <= VISIBLE_ROWS; y++) {
      ctx.beginPath()
      ctx.moveTo(BOARD_BORDER, BOARD_BORDER + y * CELL)
      ctx.lineTo(canvas.width - BOARD_BORDER, BOARD_BORDER + y * CELL)
      ctx.stroke()
    }

    // Placed puyos
    const poppedSet = new Set(anim.poppedCells.map(([x, y]) => `${x},${y}`))
    for (let row = 1; row < BOARD_ROWS; row++) {
      const visY = row - offsetRow - 1
      if (visY < 0) continue
      for (let col = 0; col < BOARD_COLS; col++) {
        const cell = board[row][col]
        if (cell === 0) continue
        const isPopped = poppedSet.has(`${col},${row}`)
        if (isPopped && anim.flashFrame > 0) {
          const flash = anim.flashFrame / 30
          this.drawPuyo(ctx, BOARD_BORDER + col * CELL, BOARD_BORDER + visY * CELL, cell, flash > 0.5 ? 1 : 0.2)
        } else if (!isPopped) {
          this.drawPuyo(ctx, BOARD_BORDER + col * CELL, BOARD_BORDER + visY * CELL, cell)
        }
      }
    }

    // Connection bridges between adjacent same-color puyos
    this.drawConnections(ctx, board, poppedSet, offsetRow, anim.flashFrame)

    // Ghost piece
    if (anim.phase === 'falling' || anim.phase === 'locking') {
      const ghost = ghostPosition(board, current)
      const [gsx, gsy] = satPos(ghost)
      // Only draw ghost if it's below the live piece (not at same position)
      if (ghost.py !== current.py || gsy !== satPos(current)[1]) {
        const ghostVisP = ghost.py - offsetRow - 1
        const ghostVisS = gsy - offsetRow - 1
        if (ghostVisP >= 0) {
          this.drawGhostPuyo(ctx, BOARD_BORDER + ghost.px * CELL, BOARD_BORDER + ghostVisP * CELL, current.pivotColor)
        }
        if (ghostVisS >= 0) {
          this.drawGhostPuyo(ctx, BOARD_BORDER + gsx * CELL, BOARD_BORDER + ghostVisS * CELL, current.satColor)
        }
      }
    }

    // Current falling pair (drawn on top of ghost)
    if (anim.phase === 'falling' || anim.phase === 'locking') {
      const [sx, sy] = satPos(current)
      const visP = current.py - offsetRow - 1
      const visS = sy - offsetRow - 1

      if (visP >= 0) {
        this.drawPuyo(ctx, BOARD_BORDER + current.px * CELL, BOARD_BORDER + visP * CELL, current.pivotColor)
      }
      if (visS >= 0) {
        this.drawPuyo(ctx, BOARD_BORDER + sx * CELL, BOARD_BORDER + visS * CELL, current.satColor)
      }
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Game over dimming
    if (anim.phase === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }

  private drawConnections(
    ctx: CanvasRenderingContext2D,
    board: Board,
    poppedSet: Set<string>,
    offsetRow: number,
    flashFrame: number
  ): void {
    const dirs: [number, number][] = [[1, 0], [0, 1]]

    for (let row = 1; row < BOARD_ROWS; row++) {
      const visY = row - offsetRow - 1
      if (visY < 0) continue
      for (let col = 0; col < BOARD_COLS; col++) {
        const cell = board[row][col]
        if (cell === 0) continue

        for (const [dx, dy] of dirs) {
          const nx = col + dx
          const ny = row + dy
          if (nx >= BOARD_COLS || ny >= BOARD_ROWS) continue
          if (board[ny][nx] !== cell) continue

          const visNY = ny - offsetRow - 1
          if (visNY < 0) continue

          const keyA = `${col},${row}`
          const keyB = `${nx},${ny}`
          const aPop = poppedSet.has(keyA)
          const bPop = poppedSet.has(keyB)

          let alpha = 1
          if (aPop || bPop) {
            if (flashFrame > 0) {
              alpha = (flashFrame / 30) > 0.5 ? 1 : 0.2
            } else {
              continue
            }
          }

          ctx.globalAlpha = alpha
          ctx.fillStyle = PUYO_COLORS[cell].fill

          if (dx === 1) {
            const x1 = BOARD_BORDER + col * CELL + CELL / 2 + RADIUS * 0.88
            const x2 = BOARD_BORDER + nx  * CELL + CELL / 2 - RADIUS * 0.88
            const cy = BOARD_BORDER + visY * CELL + CELL / 2
            const bridgeH = RADIUS * 1.7
            ctx.fillRect(x1, cy - bridgeH / 2, x2 - x1, bridgeH)
          } else {
            const cx = BOARD_BORDER + col * CELL + CELL / 2
            const y1 = BOARD_BORDER + visY  * CELL + CELL / 2 + RADIUS * 0.88
            const y2 = BOARD_BORDER + visNY * CELL + CELL / 2 - RADIUS * 0.88
            const bridgeW = RADIUS * 1.7
            ctx.fillRect(cx - bridgeW / 2, y1, bridgeW, y2 - y1)
          }
          ctx.globalAlpha = 1
        }
      }
    }
  }

  private drawGhostPuyo(ctx: CanvasRenderingContext2D, x: number, y: number, color: Cell): void {
    if (color === 0) return
    const palette = PUYO_COLORS[color]
    const cx = x + CELL / 2
    const cy = y + CELL / 2

    ctx.globalAlpha = 0.18
    ctx.fillStyle = palette.fill
    ctx.beginPath()
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 0.35
    ctx.strokeStyle = palette.glow
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.globalAlpha = 1
  }

  private drawPuyo(ctx: CanvasRenderingContext2D, x: number, y: number, color: Cell, alpha = 1): void {
    if (color === 0) return
    const palette = PUYO_COLORS[color]
    const cx = x + CELL / 2
    const cy = y + CELL / 2

    ctx.globalAlpha = alpha

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, RADIUS * 1.4)
    glow.addColorStop(0, palette.glow + '66')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, RADIUS * 1.4, 0, Math.PI * 2)
    ctx.fill()

    // Main body gradient
    const body = ctx.createRadialGradient(cx - RADIUS * 0.3, cy - RADIUS * 0.3, 0, cx, cy, RADIUS)
    body.addColorStop(0, palette.fill + 'ff')
    body.addColorStop(0.6, palette.fill + 'cc')
    body.addColorStop(1, palette.shadow + 'ff')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Glossy highlight
    const highlight = ctx.createRadialGradient(
      cx - RADIUS * 0.25, cy - RADIUS * 0.3, 0,
      cx - RADIUS * 0.1, cy - RADIUS * 0.1, RADIUS * 0.55
    )
    highlight.addColorStop(0, 'rgba(255,255,255,0.75)')
    highlight.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = highlight
    ctx.beginPath()
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // Eyes
    const eyeOffX = RADIUS * 0.25
    const eyeOffY = RADIUS * 0.1
    const eyeR = RADIUS * 0.12
    ctx.fillStyle = '#1a0030'
    ctx.beginPath()
    ctx.arc(cx - eyeOffX, cy - eyeOffY, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + eyeOffX, cy - eyeOffY, eyeR, 0, Math.PI * 2)
    ctx.fill()
    // Eye shine
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.arc(cx - eyeOffX + eyeR * 0.4, cy - eyeOffY - eyeR * 0.4, eyeR * 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + eyeOffX + eyeR * 0.4, cy - eyeOffY - eyeR * 0.4, eyeR * 0.4, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 1
  }

  private drawNext(gs: GameState): void {
    const { nextCtx: ctx, nextCanvas } = this
    const cellSz = nextCanvas.width / 3

    const grad = ctx.createLinearGradient(0, 0, 0, nextCanvas.height)
    grad.addColorStop(0, '#0d0d2b')
    grad.addColorStop(1, '#050515')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height)

    const { next } = gs
    const pivotX = 1 * cellSz
    const pivotY = 1.5 * cellSz
    const satX = pivotX + next.sdx * cellSz
    const satY = pivotY + next.sdy * cellSz

    const tmpRadius = cellSz * 0.42
    const draw = (x: number, y: number, color: number) => {
      const cx = x + cellSz / 2
      const cy = y + cellSz / 2
      const p = PUYO_COLORS[color]

      const body = ctx.createRadialGradient(cx - tmpRadius * 0.3, cy - tmpRadius * 0.3, 0, cx, cy, tmpRadius)
      body.addColorStop(0, p.fill)
      body.addColorStop(1, p.shadow)
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.arc(cx, cy, tmpRadius, 0, Math.PI * 2)
      ctx.fill()

      const hl = ctx.createRadialGradient(cx - tmpRadius * 0.25, cy - tmpRadius * 0.3, 0, cx, cy, tmpRadius * 0.55)
      hl.addColorStop(0, 'rgba(255,255,255,0.7)')
      hl.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = hl
      ctx.beginPath()
      ctx.arc(cx, cy, tmpRadius, 0, Math.PI * 2)
      ctx.fill()
    }

    draw(pivotX, pivotY, next.pivotColor)
    draw(satX, satY, next.satColor)
  }

  private updateParticles(): void {
    this.particles = this.particles.filter(p => p.life > 0)
    for (const p of this.particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.15
      p.life -= p.decay
    }
  }

  private drawFloatingTexts(): void {
    const { ctx } = this
    this.floatingTexts = this.floatingTexts.filter(ft => ft.alpha > 0)
    for (const ft of this.floatingTexts) {
      ft.y   += ft.vy
      ft.vy  *= 0.96
      ft.alpha -= 0.012
      ft.scale  = Math.min(1, ft.scale + 0.06)

      ctx.save()
      ctx.globalAlpha = Math.max(0, ft.alpha)
      ctx.translate(ft.x, ft.y)
      ctx.scale(ft.scale, ft.scale)
      ctx.font = '900 20px "Orbitron", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#ffd60a'
      ctx.shadowBlur = 14
      ctx.fillStyle = '#ffd60a'
      ctx.fillText(ft.text, 0, 0)
      ctx.shadowBlur = 0
      ctx.restore()
    }
  }
}

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; decay: number
  color: string; size: number
}

interface FloatingText {
  x: number; y: number; vy: number
  text: string; alpha: number; scale: number
}
