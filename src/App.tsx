import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react'

interface GameObject {
  x: number
  y: number
  width: number
  height: number
  type: 'spike' | 'platform' | 'orb' | 'portal'
  color?: string
}

interface Player {
  x: number
  y: number
  width: number
  height: number
  velocityY: number
  isGrounded: boolean
  rotation: number
  color: string
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>()
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver'>('menu')
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [muted, setMuted] = useState(false)
  // const [level, setLevel] = useState(1)
  
  // Game settings
  const GRAVITY = 0.6
  const JUMP_POWER = -12
  const GAME_SPEED = 4
  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 400
  
  // Player state
  const [player, setPlayer] = useState<Player>({
    x: 100,
    y: 200,
    width: 30,
    height: 30,
    velocityY: 0,
    isGrounded: false,
    rotation: 0,
    color: '#00ff88'
  })

  // Game objects
  const [objects, setObjects] = useState<GameObject[]>([])
  const [cameraX, setCameraX] = useState(0)
  const [particles, setParticles] = useState<Array<{x: number, y: number, vx: number, vy: number, life: number, color: string}>>([])

  // Generate level obstacles
  const generateObstacles = useCallback((startX: number, count: number) => {
    const newObjects: GameObject[] = []
    
    for (let i = 0; i < count; i++) {
      const x = startX + i * 200 + Math.random() * 100
      const obstacleType = Math.random()
      
      if (obstacleType < 0.4) {
        // Spike
        newObjects.push({
          x,
          y: 340,
          width: 30,
          height: 60,
          type: 'spike',
          color: '#ff3366'
        })
      } else if (obstacleType < 0.7) {
        // Platform
        newObjects.push({
          x,
          y: 250 + Math.random() * 50,
          width: 100,
          height: 20,
          type: 'platform',
          color: '#4a90e2'
        })
      } else if (obstacleType < 0.9) {
        // Jump orb
        newObjects.push({
          x,
          y: 200 + Math.random() * 100,
          width: 20,
          height: 20,
          type: 'orb',
          color: '#ffaa00'
        })
      } else {
        // Portal
        newObjects.push({
          x,
          y: 100,
          width: 15,
          height: 300,
          type: 'portal',
          color: '#aa00ff'
        })
      }
    }
    
    return newObjects
  }, [])

  // Initialize game
  const initGame = useCallback(() => {
    setPlayer({
      x: 100,
      y: 200,
      width: 30,
      height: 30,
      velocityY: 0,
      isGrounded: false,
      rotation: 0,
      color: '#00ff88'
    })
    setObjects(generateObstacles(400, 50))
    setCameraX(0)
    setScore(0)
    setParticles([])
  }, [generateObstacles])

  // Jump function
  const jump = useCallback(() => {
    if (gameState === 'playing') {
      setPlayer(prev => ({
        ...prev,
        velocityY: JUMP_POWER,
        isGrounded: false
      }))
      
      // Add jump particles
      setParticles(prev => [
        ...prev,
        ...Array.from({ length: 5 }, () => ({
          x: player.x + 15,
          y: player.y + 30,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * -3,
          life: 30,
          color: '#00ff88'
        }))
      ])
    }
  }, [gameState, player.x, player.y])

  // Collision detection
  const checkCollision = useCallback((rect1: {x: number, y: number, width: number, height: number}, rect2: {x: number, y: number, width: number, height: number}) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y
  }, [])

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return

    setPlayer(prev => {
      const newPlayer = { ...prev }
      
      // Apply gravity
      newPlayer.velocityY += GRAVITY
      newPlayer.y += newPlayer.velocityY
      
      // Rotate player
      newPlayer.rotation += 8
      
      // Check ground collision
      if (newPlayer.y + newPlayer.height >= 370) {
        newPlayer.y = 370 - newPlayer.height
        newPlayer.velocityY = 0
        newPlayer.isGrounded = true
      } else {
        newPlayer.isGrounded = false
      }
      
      // Check ceiling collision
      if (newPlayer.y <= 0) {
        newPlayer.y = 0
        newPlayer.velocityY = 0
      }
      
      return newPlayer
    })

    // Move camera
    setCameraX(prev => prev + GAME_SPEED)
    
    // Update score
    setScore(prev => prev + 1)
    
    // Check object collisions
    setObjects(prev => {
      const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height }
      
      for (const obj of prev) {
        const objRect = { x: obj.x - cameraX, y: obj.y, width: obj.width, height: obj.height }
        
        if (checkCollision(playerRect, objRect)) {
          if (obj.type === 'spike') {
            setGameState('gameOver')
            return prev
          } else if (obj.type === 'orb') {
            setPlayer(p => ({ ...p, velocityY: JUMP_POWER }))
            // Remove orb after use
            return prev.filter(o => o !== obj)
          } else if (obj.type === 'platform') {
            if (player.y + player.height <= obj.y + 10 && player.velocityY > 0) {
              setPlayer(p => ({ ...p, y: obj.y - p.height, velocityY: 0, isGrounded: true }))
            }
          }
        }
      }
      
      return prev
    })

    // Update particles
    setParticles(prev => 
      prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.2,
        life: p.life - 1
      })).filter(p => p.life > 0)
    )

    // Generate more obstacles
    if (cameraX > objects[objects.length - 1]?.x - 1000) {
      setObjects(prev => [...prev, ...generateObstacles(prev[prev.length - 1].x + 200, 20)])
    }
  }, [gameState, player, cameraX, objects, checkCollision, generateObstacles])

  // Render game
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(1, '#16213e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Draw grid background
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(CANVAS_WIDTH, i)
      ctx.stroke()
    }
    
    // Draw ground
    ctx.fillStyle = '#333'
    ctx.fillRect(0, 370, CANVAS_WIDTH, 30)
    
    // Draw objects
    objects.forEach(obj => {
      const x = obj.x - cameraX
      if (x > -obj.width && x < CANVAS_WIDTH) {
        ctx.fillStyle = obj.color || '#666'
        
        if (obj.type === 'spike') {
          // Draw triangle spike
          ctx.beginPath()
          ctx.moveTo(x + obj.width / 2, obj.y)
          ctx.lineTo(x, obj.y + obj.height)
          ctx.lineTo(x + obj.width, obj.y + obj.height)
          ctx.closePath()
          ctx.fill()
        } else if (obj.type === 'orb') {
          // Draw glowing orb
          ctx.shadowColor = obj.color
          ctx.shadowBlur = 20
          ctx.beginPath()
          ctx.arc(x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
        } else if (obj.type === 'portal') {
          // Draw portal effect
          ctx.shadowColor = obj.color
          ctx.shadowBlur = 30
          ctx.fillRect(x, obj.y, obj.width, obj.height)
          ctx.shadowBlur = 0
        } else {
          // Draw regular rectangle
          ctx.fillRect(x, obj.y, obj.width, obj.height)
        }
      }
    })
    
    // Draw particles
    particles.forEach(p => {
      ctx.fillStyle = p.color + Math.floor(p.life * 255 / 30).toString(16).padStart(2, '0')
      ctx.fillRect(p.x - cameraX, p.y, 3, 3)
    })
    
    // Draw player
    ctx.save()
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2)
    ctx.rotate(player.rotation * Math.PI / 180)
    ctx.fillStyle = player.color
    ctx.shadowColor = player.color
    ctx.shadowBlur = 10
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height)
    ctx.shadowBlur = 0
    ctx.restore()
    
    // Draw speed lines
    ctx.strokeStyle = '#ffffff20'
    ctx.lineWidth = 2
    for (let i = 0; i < 10; i++) {
      const x = (cameraX * 0.5 + i * 80) % CANVAS_WIDTH
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x - 40, CANVAS_HEIGHT)
      ctx.stroke()
    }
  }, [player, objects, cameraX, particles])

  // Handle input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
    }
    
    const handleClick = () => jump()
    
    window.addEventListener('keydown', handleKeyPress)
    window.addEventListener('click', handleClick)
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      window.removeEventListener('click', handleClick)
    }
  }, [jump])

  // Game loop effect
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(function loop() {
        gameLoop()
        render()
        gameLoopRef.current = requestAnimationFrame(loop)
      })
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, gameLoop, render])

  // Update best score
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score)
    }
  }, [score, bestScore])

  const startGame = () => {
    initGame()
    setGameState('playing')
  }

  const pauseGame = () => {
    setGameState('paused')
  }

  const resumeGame = () => {
    setGameState('playing')
  }

  const restartGame = () => {
    initGame()
    setGameState('playing')
  }

  const backToMenu = () => {
    setGameState('menu')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Geometry Dash
            </h1>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                Score: {score}
              </Badge>
              <Badge variant="outline" className="text-lg px-4 py-2">
                Best: {bestScore}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMuted(!muted)}
                className="text-white hover:bg-slate-700"
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>
            </div>
          </div>

          {/* Game Canvas */}
          <div className="relative bg-slate-900 rounded-lg p-4 mb-6">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border border-slate-600 rounded-lg bg-slate-900 mx-auto block"
            />
            
            {/* Game overlays */}
            {gameState === 'menu' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                <div className="text-center">
                  <h2 className="text-4xl font-bold text-white mb-4">
                    Welcome to Geometry Dash!
                  </h2>
                  <p className="text-gray-300 mb-6">
                    Press SPACE or click to jump and avoid obstacles
                  </p>
                  <Button onClick={startGame} size="lg" className="bg-blue-600 hover:bg-blue-700">
                    <Play className="mr-2 h-4 w-4" /> Start Game
                  </Button>
                </div>
              </div>
            )}
            
            {gameState === 'paused' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">Paused</h2>
                  <div className="space-x-4">
                    <Button onClick={resumeGame} size="lg" className="bg-green-600 hover:bg-green-700">
                      <Play className="mr-2 h-4 w-4" /> Resume
                    </Button>
                    <Button onClick={backToMenu} size="lg" variant="outline">
                      Menu
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {gameState === 'gameOver' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-red-400 mb-4">Game Over!</h2>
                  <p className="text-gray-300 mb-2">Score: {score}</p>
                  <p className="text-gray-300 mb-6">Best: {bestScore}</p>
                  <div className="space-x-4">
                    <Button onClick={restartGame} size="lg" className="bg-blue-600 hover:bg-blue-700">
                      <RotateCcw className="mr-2 h-4 w-4" /> Try Again
                    </Button>
                    <Button onClick={backToMenu} size="lg" variant="outline">
                      Menu
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            {gameState === 'playing' && (
              <Button onClick={pauseGame} variant="outline" size="lg">
                <Pause className="mr-2 h-4 w-4" /> Pause
              </Button>
            )}
            <div className="text-center text-gray-400">
              <p className="text-sm">Press SPACE or click to jump</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App