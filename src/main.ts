import './style.css'
import { Renderer } from './renderer/Renderer'
import {
  createGame, tick, moveLeft, moveRight,
  rotatePairCW, rotatePairCCW, hardDrop,
  type GameState,
} from './game/GameEngine'
import { Audio, setMuted, isMuted } from './ui/Audio'

// ── DOM refs ────────────────────────────────────────────────────────────────
const canvas          = document.getElementById('game-canvas')        as HTMLCanvasElement
const nextCanvas      = document.getElementById('next-canvas')        as HTMLCanvasElement
const scoreEl         = document.getElementById('score')              as HTMLElement
const hiScoreEl       = document.getElementById('hi-score')           as HTMLElement
const levelEl         = document.getElementById('level')              as HTMLElement
const chainEl         = document.getElementById('chain')              as HTMLElement
const chainBadge      = document.getElementById('chain-badge')        as HTMLElement
const overlay         = document.getElementById('overlay')            as HTMLElement
const overlayTitle    = document.getElementById('overlay-title')      as HTMLElement
const overlaySubtitle = document.getElementById('overlay-subtitle')   as HTMLElement
const overlayScoreWrap= document.getElementById('overlay-score-wrap') as HTMLElement
const finalScore      = document.getElementById('final-score')        as HTMLElement
const startBtn        = document.getElementById('start-btn')          as HTMLButtonElement
const muteBtn         = document.getElementById('mute-btn')           as HTMLButtonElement
const muteIcon        = document.getElementById('mute-icon')          as HTMLElement

// ── State ───────────────────────────────────────────────────────────────────
const renderer = new Renderer(canvas, nextCanvas)
let gs: GameState | null = null
let lastTime = 0
let softDrop = false
let rafId = 0
let prevChain = 0
let prevScore = 0
let prevPhase = ''

const LS_KEY = 'puyopuyo_hi'
function getHiScore() { return parseInt(localStorage.getItem(LS_KEY) ?? '0', 10) }
function saveHiScore(s: number) { localStorage.setItem(LS_KEY, String(s)) }

// ── Game loop ────────────────────────────────────────────────────────────────
function loop(ts: number) {
  if (!gs) return
  const dt = Math.min(ts - lastTime, 100)
  lastTime = ts

  const prev = gs
  gs = tick(gs, dt, softDrop)

  // Particle burst when new pops start
  if (gs.anim.poppedCells.length && !prev.anim.poppedCells.length) {
    renderer.spawnParticles(gs.anim.poppedCells, prev.board)
  }

  // Chain popup + audio
  if (gs.chain !== prevChain && gs.chain > 0) {
    Audio.pop(gs.chain)
    renderer.spawnFloatingText(canvas.width / 2, canvas.height * 0.25, `CHAIN ${gs.chain}!`)
    prevChain = gs.chain
  }

  // Score delta popup
  const scoreDelta = gs.score - prevScore
  if (scoreDelta > 0 && gs.chain > 0) {
    renderer.spawnFloatingText(canvas.width / 2, canvas.height * 0.36, `+${scoreDelta.toLocaleString()}`)
  }
  prevScore = gs.score

  // Game over
  if (gs.anim.phase === 'gameover' && prevPhase !== 'gameover') {
    Audio.gameOver()
    saveHiScore(gs.highScore)
    showOverlay('gameover', gs.score)
  }
  prevPhase = gs.anim.phase

  updateHUD(gs)
  renderer.render(gs)

  if (gs.anim.phase !== 'gameover') {
    rafId = requestAnimationFrame(loop)
  }
}

// ── HUD ─────────────────────────────────────────────────────────────────────
function updateHUD(state: GameState) {
  scoreEl.textContent   = state.score.toLocaleString()
  hiScoreEl.textContent = state.highScore.toLocaleString()
  levelEl.textContent   = String(state.level)
  if (state.chain > 1) {
    chainEl.textContent = `${state.chain}×`
    chainBadge.classList.add('active')
  } else {
    chainBadge.classList.remove('active')
  }
}

function showOverlay(mode: 'title' | 'gameover', score = 0): void {
  if (mode === 'title') {
    overlayTitle.textContent = 'PUYO PUYO'
    overlayTitle.className   = 'overlay-title title'
    overlaySubtitle.textContent = 'NEON EDITION'
    overlayScoreWrap.style.display = 'none'
    startBtn.textContent = 'PRESS START'
  } else {
    overlayTitle.textContent = 'GAME OVER'
    overlayTitle.className   = 'overlay-title gameover'
    overlaySubtitle.textContent = ''
    overlayScoreWrap.style.display = 'flex'
    finalScore.textContent = score.toLocaleString()
    startBtn.textContent = 'PLAY AGAIN'
  }
  overlay.classList.add('visible')
}

// ── Input ────────────────────────────────────────────────────────────────────
const keys = new Set<string>()

// Global hotkeys (work regardless of game state)
window.addEventListener('keydown', e => {
  if (e.code === 'KeyM') { muteBtn.click(); return }
  if (e.code === 'Enter' && overlay.classList.contains('visible')) { startGame(); return }
})

// Game controls
window.addEventListener('keydown', e => {
  if (!gs || gs.anim.phase === 'gameover') return
  keys.add(e.code)

  switch (e.code) {
    case 'ArrowLeft':  { const n = moveLeft(gs);       if (n !== gs) Audio.move();   gs = n; break }
    case 'ArrowRight': { const n = moveRight(gs);      if (n !== gs) Audio.move();   gs = n; break }
    case 'ArrowDown':  softDrop = true; break
    case 'ArrowUp':
    case 'KeyX':       { const n = rotatePairCW(gs);  if (n !== gs) Audio.rotate(); gs = n; break }
    case 'KeyZ':       { const n = rotatePairCCW(gs); if (n !== gs) Audio.rotate(); gs = n; break }
    case 'Space':      { gs = hardDrop(gs); break }
    default: return
  }
  e.preventDefault()
})

window.addEventListener('keyup', e => {
  keys.delete(e.code)
  if (e.code === 'ArrowDown') softDrop = false
})

// Touch / swipe support
let touchStartX = 0, touchStartY = 0, touchStartTime = 0

canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  touchStartTime = Date.now()
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('touchend', e => {
  if (!gs || gs.anim.phase === 'gameover') return
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  const dt = Date.now() - touchStartTime
  const absDx = Math.abs(dx), absDy = Math.abs(dy)

  if (dt < 250 && absDx < 10 && absDy < 10) {
    gs = rotatePairCW(gs); Audio.rotate()
  } else if (absDx > absDy && absDx > 20) {
    gs = dx > 0 ? moveRight(gs) : moveLeft(gs); Audio.move()
  } else if (dy > 40) {
    softDrop = true
    setTimeout(() => { softDrop = false }, 300)
  } else if (dy < -40) {
    gs = hardDrop(gs)
  }
  e.preventDefault()
}, { passive: false })

// ── Mute toggle ──────────────────────────────────────────────────────────────
muteBtn.addEventListener('click', () => {
  const nowMuted = !isMuted()
  setMuted(nowMuted)
  muteIcon.textContent = nowMuted ? '🔇' : '🔊'
  muteBtn.classList.toggle('muted', nowMuted)
})

// ── Start / Restart ───────────────────────────────────────────────────────────
function startGame() {
  cancelAnimationFrame(rafId)
  overlay.classList.remove('visible')
  prevChain = 0
  prevScore = 0
  prevPhase = ''
  softDrop  = false
  gs = createGame(getHiScore())
  lastTime = performance.now()
  rafId = requestAnimationFrame(loop)
}

startBtn.addEventListener('click', startGame)

// ── Show title screen on load ─────────────────────────────────────────────────
showOverlay('title')
