import React, { useEffect, useRef, useState } from 'react';

// --- Game Constants ---
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const PLAYER_SPEED = 6;
const BULLET_SPEED = 15;
const ENEMY_SPEED_BASE = 2;
const FIRE_COOLDOWN = 10; // Frames between shots
const STAR_COUNT = 100;

// --- Types ---
type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  cooldown: number;
  hp: number;
  invulnerable: number;
};

type Bullet = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  vy: number;
  isEnemy: boolean;
  markedForDeletion: boolean;
};

type Enemy = {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  type: 'basic' | 'weaver' | 'tank';
  markedForDeletion: boolean;
  timer: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

type Star = {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
};

type GameState = {
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  stars: Star[];
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
  keys: { [key: string]: boolean };
  frame: number;
  difficultyMultiplier: number;
};

// --- Helper Functions ---
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

const checkCollision = (rect1: any, rect2: any) => {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
};

// --- Drawing Functions ---
const drawPlayerShip = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, isInvulnerable: boolean, frame: number) => {
  if (isInvulnerable && Math.floor(frame / 4) % 2 === 0) return; // Flicker effect

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);

  // Engine flame
  ctx.fillStyle = Math.floor(frame / 2) % 2 === 0 ? '#ffaa00' : '#ff0000';
  ctx.beginPath();
  ctx.moveTo(-6, height / 2 - 4);
  ctx.lineTo(6, height / 2 - 4);
  ctx.lineTo(0, height / 2 + randomRange(10, 20));
  ctx.fill();

  // Main body
  ctx.fillStyle = '#e2e8f0'; // Light gray
  ctx.beginPath();
  ctx.moveTo(0, -height / 2);
  ctx.lineTo(width / 2, height / 2 - 5);
  ctx.lineTo(-width / 2, height / 2 - 5);
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#38bdf8'; // Light blue
  ctx.beginPath();
  ctx.moveTo(0, -height / 4);
  ctx.lineTo(4, 0);
  ctx.lineTo(-4, 0);
  ctx.fill();

  // Wings
  ctx.fillStyle = '#ef4444'; // Red accents
  ctx.beginPath();
  ctx.moveTo(-width / 2, height / 2 - 5);
  ctx.lineTo(-width / 2 - 10, height / 2 + 5);
  ctx.lineTo(-width / 2 + 5, height / 2 - 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width / 2, height / 2 - 5);
  ctx.lineTo(width / 2 + 10, height / 2 + 5);
  ctx.lineTo(width / 2 - 5, height / 2 - 5);
  ctx.fill();

  ctx.restore();
};

const drawEnemyShip = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
  ctx.save();
  ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);

  if (enemy.type === 'basic') {
    ctx.fillStyle = '#8b5cf6'; // Purple
    ctx.beginPath();
    ctx.moveTo(0, enemy.height / 2);
    ctx.lineTo(enemy.width / 2, -enemy.height / 2);
    ctx.lineTo(-enemy.width / 2, -enemy.height / 2);
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#fde047'; // Yellow
    ctx.fillRect(-3, -enemy.height / 4, 6, 6);
  } else if (enemy.type === 'weaver') {
    ctx.fillStyle = '#10b981'; // Green
    ctx.beginPath();
    ctx.moveTo(0, enemy.height / 2);
    ctx.lineTo(enemy.width / 2, 0);
    ctx.lineTo(0, -enemy.height / 2);
    ctx.lineTo(-enemy.width / 2, 0);
    ctx.fill();
  } else if (enemy.type === 'tank') {
    ctx.fillStyle = '#f97316'; // Orange
    ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
    ctx.fillStyle = '#475569'; // Dark gray
    ctx.fillRect(-enemy.width / 2 + 5, -enemy.height / 2 + 5, enemy.width - 10, enemy.height - 10);
  }

  // HP Bar if damaged
  if (enemy.hp < enemy.maxHp) {
    const hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'red';
    ctx.fillRect(-enemy.width / 2, -enemy.height / 2 - 8, enemy.width, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-enemy.width / 2, -enemy.height / 2 - 8, enemy.width * hpPercent, 4);
  }

  ctx.restore();
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [hp, setHp] = useState(3);

  const stateRef = useRef<GameState>({
    player: { x: CANVAS_WIDTH / 2 - 20, y: CANVAS_HEIGHT - 80, width: 40, height: 40, cooldown: 0, hp: 3, invulnerable: 0 },
    bullets: [],
    enemies: [],
    particles: [],
    stars: [],
    score: 0,
    isGameOver: false,
    isPaused: false,
    keys: {},
    frame: 0,
    difficultyMultiplier: 1,
  });

  const requestRef = useRef<number>(null);

  // --- Initialization ---
  const initGame = () => {
    const stars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 3 + 1,
        color: Math.random() > 0.5 ? '#ffffff' : '#94a3b8',
      });
    }

    stateRef.current = {
      player: { x: CANVAS_WIDTH / 2 - 20, y: CANVAS_HEIGHT - 80, width: 40, height: 40, cooldown: 0, hp: 3, invulnerable: 0 },
      bullets: [],
      enemies: [],
      particles: [],
      stars,
      score: 0,
      isGameOver: false,
      isPaused: false,
      keys: stateRef.current.keys, // Preserve key state
      frame: 0,
      difficultyMultiplier: 1,
    };
    setScore(0);
    setHp(3);
    setGameOver(false);
    setGameStarted(true);
  };

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = true;
      // Prevent default scrolling for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Game Loop ---
  const update = () => {
    const state = stateRef.current;
    if (state.isGameOver || state.isPaused || !gameStarted) return;

    state.frame++;

    // Difficulty scaling
    state.difficultyMultiplier = 1 + Math.floor(state.score / 1000) * 0.2;

    // --- Player Movement ---
    if (state.keys['ArrowLeft'] || state.keys['KeyA']) state.player.x -= PLAYER_SPEED;
    if (state.keys['ArrowRight'] || state.keys['KeyD']) state.player.x += PLAYER_SPEED;
    if (state.keys['ArrowUp'] || state.keys['KeyW']) state.player.y -= PLAYER_SPEED;
    if (state.keys['ArrowDown'] || state.keys['KeyS']) state.player.y += PLAYER_SPEED;

    // Clamp player to screen
    state.player.x = Math.max(0, Math.min(CANVAS_WIDTH - state.player.width, state.player.x));
    state.player.y = Math.max(0, Math.min(CANVAS_HEIGHT - state.player.height, state.player.y));

    // Player cooldown & invulnerability
    if (state.player.cooldown > 0) state.player.cooldown--;
    if (state.player.invulnerable > 0) state.player.invulnerable--;

    // --- Player Shooting ---
    if (state.keys['Space'] && state.player.cooldown <= 0) {
      state.bullets.push({
        x: state.player.x + state.player.width / 2 - 3,
        y: state.player.y - 10,
        width: 6,
        height: 15,
        color: '#fde047', // Yellow bullet
        vy: -BULLET_SPEED,
        isEnemy: false,
        markedForDeletion: false,
      });
      state.player.cooldown = FIRE_COOLDOWN;
      
      // Small recoil particles
      for(let i=0; i<3; i++) {
        state.particles.push({
          x: state.player.x + state.player.width / 2,
          y: state.player.y,
          vx: randomRange(-1, 1),
          vy: randomRange(1, 3),
          life: 10,
          maxLife: 10,
          color: '#fde047',
          size: 2
        });
      }
    }

    // --- Enemy Spawning ---
    const spawnRate = Math.max(20, 60 - state.difficultyMultiplier * 5);
    if (state.frame % Math.floor(spawnRate) === 0) {
      const rand = Math.random();
      let type: Enemy['type'] = 'basic';
      let hp = 1;
      let width = 30;
      let height = 30;

      if (rand > 0.8 && state.difficultyMultiplier > 1.2) {
        type = 'tank';
        hp = 5;
        width = 50;
        height = 50;
      } else if (rand > 0.5 && state.difficultyMultiplier > 1.1) {
        type = 'weaver';
        hp = 2;
        width = 25;
        height = 25;
      }

      state.enemies.push({
        x: randomRange(0, CANVAS_WIDTH - width),
        y: -height,
        width,
        height,
        hp: hp * Math.ceil(state.difficultyMultiplier),
        maxHp: hp * Math.ceil(state.difficultyMultiplier),
        vx: type === 'weaver' ? (Math.random() > 0.5 ? 2 : -2) : 0,
        vy: ENEMY_SPEED_BASE * (type === 'tank' ? 0.5 : type === 'weaver' ? 1.5 : 1) * state.difficultyMultiplier,
        type,
        markedForDeletion: false,
        timer: 0,
      });
    }

    // --- Update Entities ---
    // Stars
    state.stars.forEach(star => {
      star.y += star.speed;
      if (star.y > CANVAS_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CANVAS_WIDTH;
      }
    });

    // Bullets
    state.bullets.forEach(bullet => {
      bullet.y += bullet.vy;
      if (bullet.y < -50 || bullet.y > CANVAS_HEIGHT + 50) {
        bullet.markedForDeletion = true;
      }
    });

    // Enemies
    state.enemies.forEach(enemy => {
      enemy.timer++;
      
      if (enemy.type === 'weaver') {
        enemy.x += enemy.vx;
        if (enemy.x <= 0 || enemy.x + enemy.width >= CANVAS_WIDTH) {
          enemy.vx *= -1;
        }
      }
      
      enemy.y += enemy.vy;

      // Enemy shooting (basic and tank)
      if (enemy.type === 'tank' && enemy.timer % 60 === 0) {
        state.bullets.push({
          x: enemy.x + enemy.width / 2 - 4,
          y: enemy.y + enemy.height,
          width: 8,
          height: 15,
          color: '#ef4444',
          vy: BULLET_SPEED * 0.5,
          isEnemy: true,
          markedForDeletion: false,
        });
      } else if (enemy.type === 'basic' && enemy.timer % 90 === 0 && Math.random() > 0.5) {
         state.bullets.push({
          x: enemy.x + enemy.width / 2 - 3,
          y: enemy.y + enemy.height,
          width: 6,
          height: 12,
          color: '#ef4444',
          vy: BULLET_SPEED * 0.6,
          isEnemy: true,
          markedForDeletion: false,
        });
      }

      if (enemy.y > CANVAS_HEIGHT) {
        enemy.markedForDeletion = true;
      }
    });

    // Particles
    state.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    });

    // --- Collisions ---
    // Player bullets hitting enemies
    state.bullets.filter(b => !b.isEnemy && !b.markedForDeletion).forEach(bullet => {
      state.enemies.filter(e => !e.markedForDeletion).forEach(enemy => {
        if (checkCollision(bullet, enemy)) {
          bullet.markedForDeletion = true;
          enemy.hp--;

          // Hit particles
          for(let i=0; i<5; i++) {
            state.particles.push({
              x: bullet.x,
              y: bullet.y,
              vx: randomRange(-2, 2),
              vy: randomRange(-2, 2),
              life: 15,
              maxLife: 15,
              color: '#fde047',
              size: 3
            });
          }

          if (enemy.hp <= 0) {
            enemy.markedForDeletion = true;
            state.score += enemy.type === 'tank' ? 50 : enemy.type === 'weaver' ? 20 : 10;
            
            // Explosion particles
            for(let i=0; i<20; i++) {
              state.particles.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height / 2,
                vx: randomRange(-4, 4),
                vy: randomRange(-4, 4),
                life: randomRange(20, 40),
                maxLife: 40,
                color: Math.random() > 0.5 ? '#ef4444' : '#f97316',
                size: randomRange(2, 6)
              });
            }
          }
        }
      });
    });

    // Enemy bullets hitting player
    if (state.player.invulnerable <= 0) {
      state.bullets.filter(b => b.isEnemy && !b.markedForDeletion).forEach(bullet => {
        // Make player hitbox slightly smaller than visual size for fairness
        const playerHitbox = {
          x: state.player.x + 10,
          y: state.player.y + 10,
          width: state.player.width - 20,
          height: state.player.height - 20
        };

        if (checkCollision(bullet, playerHitbox)) {
          bullet.markedForDeletion = true;
          takeDamage();
        }
      });

      // Enemies hitting player
      state.enemies.filter(e => !e.markedForDeletion).forEach(enemy => {
        const playerHitbox = {
          x: state.player.x + 5,
          y: state.player.y + 5,
          width: state.player.width - 10,
          height: state.player.height - 10
        };
        if (checkCollision(enemy, playerHitbox)) {
          enemy.markedForDeletion = true;
          takeDamage();
        }
      });
    }

    // --- Cleanup ---
    state.bullets = state.bullets.filter(b => !b.markedForDeletion);
    state.enemies = state.enemies.filter(e => !e.markedForDeletion);
    state.particles = state.particles.filter(p => p.life > 0);

    // Sync React state for UI
    if (state.frame % 5 === 0) {
      setScore(state.score);
      setHp(state.player.hp);
    }
  };

  const takeDamage = () => {
    const state = stateRef.current;
    state.player.hp--;
    state.player.invulnerable = 60; // 1 second of invulnerability at 60fps
    
    // Damage particles
    for(let i=0; i<30; i++) {
      state.particles.push({
        x: state.player.x + state.player.width / 2,
        y: state.player.y + state.player.height / 2,
        vx: randomRange(-5, 5),
        vy: randomRange(-5, 5),
        life: randomRange(30, 60),
        maxLife: 60,
        color: '#38bdf8',
        size: randomRange(2, 5)
      });
    }

    if (state.player.hp <= 0) {
      state.isGameOver = true;
      setGameOver(true);
      setHp(0);
    } else {
      setHp(state.player.hp);
    }
  };

  // --- Rendering ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    const state = stateRef.current;

    // Clear canvas
    ctx.fillStyle = '#0f172a'; // Dark slate background
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Stars
    state.stars.forEach(star => {
      ctx.fillStyle = star.color;
      ctx.globalAlpha = star.speed / 4; // Faster stars are brighter
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.globalAlpha = 1.0;

    if (!gameStarted) return;

    // Draw Particles
    state.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    // Draw Bullets
    state.bullets.forEach(bullet => {
      ctx.fillStyle = bullet.color;
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      // Glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = bullet.color;
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      ctx.shadowBlur = 0;
    });

    // Draw Enemies
    state.enemies.forEach(enemy => {
      drawEnemyShip(ctx, enemy);
    });

    // Draw Player
    if (!state.isGameOver) {
      drawPlayerShip(ctx, state.player.x, state.player.y, state.player.width, state.player.height, state.player.invulnerable > 0, state.frame);
    }
  };

  // --- Main Loop ---
  const loop = (time: number) => {
    update();
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) draw(ctx);
    }
    
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    // Initial draw for start screen
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStarted]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center font-['Press_Start_2P'] text-white selection:bg-transparent">
      <div className="relative shadow-2xl shadow-indigo-500/20 rounded-lg overflow-hidden border-4 border-slate-800">
        
        {/* UI Overlay */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none z-10">
          {gameStarted && (
            <>
              <div className="flex flex-col gap-2">
                <div className="text-xl text-yellow-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  SCORE: {score.toString().padStart(6, '0')}
                </div>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-6 h-6 ${i < hp ? 'bg-red-500' : 'bg-slate-800'} border-2 border-white transform rotate-45`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Start Screen */}
        {!gameStarted && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
            <h1 className="text-4xl text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-indigo-600 mb-8 text-center leading-relaxed drop-shadow-lg">
              SUPER<br/>SPACE<br/>SHOOTER
            </h1>
            <div className="text-sm text-slate-300 mb-8 text-center leading-loose">
              <p>ARROWS / WASD to Move</p>
              <p>SPACE to Shoot</p>
            </div>
            <button 
              onClick={initGame}
              className="px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white border-4 border-indigo-400 hover:border-white transition-all active:scale-95"
            >
              START GAME
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {gameOver && (
          <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
            <h2 className="text-5xl text-red-500 mb-4 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">GAME OVER</h2>
            <p className="text-xl text-yellow-400 mb-8">FINAL SCORE: {score}</p>
            <button 
              onClick={initGame}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white border-4 border-slate-500 hover:border-white transition-all active:scale-95"
            >
              TRY AGAIN
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block bg-slate-900"
          style={{ width: '100%', maxWidth: '600px', height: 'auto', aspectRatio: '3/4' }}
        />
      </div>
    </div>
  );
}
