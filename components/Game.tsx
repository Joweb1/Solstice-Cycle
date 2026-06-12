import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
    CANVAS_HEIGHT, CANVAS_WIDTH, GRID_SIZE, INITIAL_PLAYER, SKINS,
    BULLET_SPEED, BULLET_DAMAGE, FIRE_RATE_MS, PLAYER_RANGE, PLAYER_FOV, 
    PLAYER_FIRE_RATE_MS, PLAYER_BULLET_DAMAGE, XP_PER_KILL, XP_PER_LEVEL_COMPLETE,
    CREDITS_PER_KILL, CREDITS_PER_LEVEL_COMPLETE, LASER_DAMAGE_PER_FRAME, 
    BARREL_DAMAGE, BARREL_EXPLOSION_RADIUS,
    POWERUP_MEDKIT_HEAL, POWERUP_SHIELD_AMOUNT, POWERUP_SPEED_DURATION, 
    POWERUP_SPEED_MULTIPLIER, POWERUP_STEALTH_DURATION
} from '../constants';
import { Player, Enemy, Wall, Point, Bullet, Particle, GameState, EnemyType, Skin, Decoration, Laser, Environment, Powerup } from '../types';
import { generateLevel } from '../utils/aiGameMaster';

// --- MATH UTILS ---
function dist(x1: number, y1: number, x2: number, y2: number) { 
    return Math.sqrt((x1-x2)**2 + (y1-y2)**2); 
}

function rectOverlap(r1: {x: number, y: number, w: number, h: number}, r2: {x: number, y: number, w: number, h: number}) {
    return !(r2.x >= r1.x + r1.w || 
             r2.x + r2.w <= r1.x || 
             r2.y >= r1.y + r1.h || 
             r2.y + r2.h <= r1.y);
}

function lineLine(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
    let uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
    let uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
    return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
}

function lineRect(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number) {
    const left = lineLine(x1,y1,x2,y2, rx,ry,rx, ry+rh);
    const right = lineLine(x1,y1,x2,y2, rx+rw,ry,rx+rw, ry+rh);
    const top = lineLine(x1,y1,x2,y2, rx,ry,rx+rw, ry);
    const bottom = lineLine(x1,y1,x2,y2, rx,ry+rh,rx+rw, ry+rh);
    return left || right || top || bottom;
}

const ENEMY_COLORS: Record<EnemyType, string> = {
    soldier: '#d32f2f', // Red
    scout: '#fbc02d',   // Yellow
    sniper: '#7b1fa2',  // Purple
    heavy: '#37474f'    // Dark Grey
};

const ENEMY_RADII: Record<EnemyType, number> = {
    soldier: 12,
    scout: 9,
    sniper: 11,
    heavy: 15
};

const TUTORIAL_SLIDES = [
    {
        title: "MISSION BRIEF",
        content: "Eliminate all hostile targets to clear the area.\n\nSurvival is your priority. If your VITALITY reaches zero, the operation fails.",
        icon: "🎯"
    },
    {
        title: "CONTROLS",
        content: "TAP anywhere on the floor to move there automatically.\n\nDRAG and HOLD anywhere on the screen to use the JOYSTICK for precise movement and aiming.",
        icon: "🕹️"
    },
    {
        title: "TACTICS",
        content: "Enemies will shoot on sight. Use walls for COVER.\n\nAttack from blind spots or while they are patrolling away from you.",
        icon: "👁️"
    },
    {
        title: "HAZARDS",
        content: "⚠️ Shoot RED BARRELS to cause massive explosions.\n⚠️ Avoid LASERS, they deal continuous damage.",
        icon: "💥"
    },
    {
        title: "SUPPLY DROPS",
        content: "Collect powerups to aid your mission:",
        isPowerupSlide: true,
        icon: "📦"
    }
];

export default function Game() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // --- REACT STATE (UI) ---
    const [gameState, setGameState] = useState<GameState>({
        currentLevel: 1,
        enemiesRemaining: 0,
        totalEnemies: 0,
        status: 'menu',
        difficultyMultiplier: 1.0
    });
    
    const [playerStats, setPlayerStats] = useState({
        hp: INITIAL_PLAYER.maxHp,
        xp: 0,
        level: 1,
        nextLevelXp: 1000,
        credits: 0
    });

    const [shopSkinId, setShopSkinId] = useState<string>('default');
    const [tutorialStep, setTutorialStep] = useState(0);

    // --- MUTABLE REFS (GAME LOGIC) ---
    const playerRef = useRef<Player>(JSON.parse(JSON.stringify(INITIAL_PLAYER)));
    const enemiesRef = useRef<Enemy[]>([]);
    const wallsRef = useRef<Wall[]>([]);
    const decorationsRef = useRef<Decoration[]>([]);
    const lasersRef = useRef<Laser[]>([]);
    const bulletsRef = useRef<Bullet[]>([]);
    const powerupsRef = useRef<Powerup[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const ambientParticlesRef = useRef<Particle[]>([]);
    const gridMapRef = useRef<number[][]>([]);
    const damageTraumaRef = useRef<number>(0); 
    
    // Environment
    const environmentRef = useRef<Environment>({
        timeOfDay: 'day',
        temperature: 'normal',
        bgColor: '#202020',
        gridColor: '#2a2a2a',
        overlayColor: 'transparent'
    });

    // Joystick State
    const joystickRef = useRef({ active: false, angle: 0, pointerId: -1 });
    // Refs for direct DOM manipulation of joystick to sync with 60FPS loop
    const joystickContainerRef = useRef<HTMLDivElement>(null);
    const joystickKnobRef = useRef<HTMLDivElement>(null);

    const cols = Math.ceil(CANVAS_WIDTH / GRID_SIZE);
    const rows = Math.ceil(CANVAS_HEIGHT / GRID_SIZE);
    const requestRef = useRef<number>();

    // --- INITIALIZATION ---
    useEffect(() => {
        // Check for first time play
        const seenTutorial = localStorage.getItem('ha_tutorial_seen');
        if (!seenTutorial) {
            setGameState(prev => ({...prev, status: 'tutorial'}));
        }
    }, []);
    
    const isLineBlocked = useCallback((x1: number, y1: number, x2: number, y2: number) => {
        for (let w of wallsRef.current) {
            // Treat treasure and drums as shorter obstacles
            if (lineRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) return true;
        }
        return false;
    }, []);

    const initGrid = useCallback(() => {
        const grid = new Array(cols).fill(0).map(() => new Array(rows).fill(0));
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                let tileRect = {x: i * GRID_SIZE, y: j * GRID_SIZE, w: GRID_SIZE, h: GRID_SIZE};
                grid[i][j] = 0; // Walkable
                for (let w of wallsRef.current) {
                    if (rectOverlap(tileRect, w)) {
                        grid[i][j] = 1; // Blocked
                        break;
                    }
                }
            }
        }
        gridMapRef.current = grid;
    }, [cols, rows]);

    const isBlocked = (col: number, row: number) => {
        if (col < 0 || col >= cols || row < 0 || row >= rows) return true;
        return gridMapRef.current[col][row] === 1;
    };

    const findPath = (startX: number, startY: number, endX: number, endY: number): Point[] => {
        let startCol = Math.floor(startX / GRID_SIZE);
        let startRow = Math.floor(startY / GRID_SIZE);
        let endCol = Math.floor(endX / GRID_SIZE);
        let endRow = Math.floor(endY / GRID_SIZE);

        if (isBlocked(startCol, startRow) || isBlocked(endCol, endRow)) return [];

        let queue = [{x: startCol, y: startRow}];
        let visited = new Set<string>();
        let parentMap = new Map<string, Point>();
        visited.add(`${startCol},${startRow}`);
        let found = false;

        while (queue.length > 0) {
            let current = queue.shift()!;
            if (current.x === endCol && current.y === endRow) {
                found = true;
                break;
            }

            const neighbors = [ {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0} ];
            for (let neighbor of neighbors) {
                let nextX = current.x + neighbor.x;
                let nextY = current.y + neighbor.y;
                let nextKey = `${nextX},${nextY}`;

                if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && 
                    !isBlocked(nextX, nextY) && !visited.has(nextKey)) {
                    visited.add(nextKey);
                    parentMap.set(nextKey, current);
                    queue.push({x: nextX, y: nextY});
                }
            }
        }

        if (!found) return [];

        let path: Point[] = [];
        let curr = {x: endCol, y: endRow};
        while (curr.x !== startCol || curr.y !== startRow) {
            path.unshift({x: curr.x * GRID_SIZE + GRID_SIZE/2, y: curr.y * GRID_SIZE + GRID_SIZE/2});
            let key = `${curr.x},${curr.y}`;
            let parent = parentMap.get(key);
            if (!parent) break;
            curr = parent;
        }
        path.push({x: endX, y: endY});
        return path;
    };

    const createParticles = (x: number, y: number, color: string, type: 'smoke' | 'fire' | 'spark' | 'shockwave' | 'snow' | 'ember' | 'dust' | 'heal' | 'buff' = 'spark', count = 15) => {
        if (type === 'shockwave') {
            particlesRef.current.push({ x, y, vx: 0, vy: 0, life: 1.0, color, type: 'shockwave', size: 1 });
            return;
        }
        for(let i=0; i<count; i++) {
            particlesRef.current.push({ 
                x: x, y: y, 
                vx: (Math.random() - 0.5) * (type === 'fire' ? 8 : (type === 'heal' ? 2 : 5)), 
                vy: (Math.random() - 0.5) * (type === 'fire' ? 8 : (type === 'heal' ? 2 : 5)), 
                life: 1.0, 
                color: color,
                type
            });
        }
    };

    // --- EXPLOSION LOGIC ---
    const triggerExplosion = (source: {x: number, y: number}) => {
        // Visuals
        createParticles(source.x, source.y, '#FFA500', 'fire', 40);
        createParticles(source.x, source.y, '#333', 'smoke', 30);
        createParticles(source.x, source.y, '#FFF', 'shockwave');
        
        // Add heavy trauma (additive to stack multiple explosions)
        damageTraumaRef.current = Math.min(2.5, damageTraumaRef.current + 1.2);

        // Damage Player
        const pDist = dist(source.x, source.y, playerRef.current.x, playerRef.current.y);
        if (pDist < BARREL_EXPLOSION_RADIUS) {
            let dmg = BARREL_DAMAGE * (1 - pDist/BARREL_EXPLOSION_RADIUS);
            
            // Shield Absorption
            if (playerRef.current.shield > 0) {
                if (playerRef.current.shield >= dmg) {
                    playerRef.current.shield -= dmg;
                    dmg = 0;
                } else {
                    dmg -= playerRef.current.shield;
                    playerRef.current.shield = 0;
                }
            }

            playerRef.current.hp -= dmg;
            setPlayerStats(prev => ({...prev, hp: Math.max(0, playerRef.current.hp)}));
            if (playerRef.current.hp <= 0) {
                playerRef.current.dead = true;
                setGameState(prev => ({...prev, status: 'gameover'}));
            }
        }

        // Damage Enemies
        enemiesRef.current.forEach(en => {
            if (!en.alive) return;
            const eDist = dist(source.x, source.y, en.x, en.y);
            if (eDist < BARREL_EXPLOSION_RADIUS) {
                en.hp -= BARREL_DAMAGE * (1 - eDist/BARREL_EXPLOSION_RADIUS);
                createParticles(en.x, en.y, '#d32f2f', 'spark', 10);
                if (en.hp <= 0) {
                    en.alive = false;
                    setPlayerStats(prev => {
                        const newXp = prev.xp + XP_PER_KILL;
                        const newCredits = prev.credits + CREDITS_PER_KILL;
                        let newLevel = prev.level;
                        let nextXp = prev.nextLevelXp;
                        if (newXp >= nextXp) { newLevel++; nextXp = Math.floor(nextXp * 1.5); }
                        playerRef.current.credits = newCredits;
                        return { ...prev, xp: newXp, level: newLevel, nextLevelXp: nextXp, credits: newCredits };
                    });
                    setGameState(prev => ({...prev, enemiesRemaining: prev.enemiesRemaining - 1}));
                }
            }
        });

        // Chain Reaction to other barrels
        wallsRef.current.forEach(w => {
            if (w.type === 'barrel' && !w.markedForDeletion) {
                const center = { x: w.x + w.w/2, y: w.y + w.h/2 };
                if (dist(source.x, source.y, center.x, center.y) < BARREL_EXPLOSION_RADIUS) {
                    w.hp = 0;
                    w.markedForDeletion = true;
                    // Recursive explosion with slight delay could be cool, but immediate is fine for chain reaction
                    triggerExplosion(center);
                }
            }
        });
    };

    // --- SPRITE DRAWING ---
    const drawSprite = (
        ctx: CanvasRenderingContext2D, 
        x: number, 
        y: number, 
        angle: number, 
        radius: number, 
        colors: { body: string, helmet: string, visor: string, vest: string },
        isEnemy: boolean = false
    ) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Shoulders (Body)
        ctx.fillStyle = colors.body;
        ctx.beginPath();
        // Left shoulder
        ctx.ellipse(0, -6, radius * 0.9, radius * 0.5, 0, 0, Math.PI * 2);
        // Right shoulder
        ctx.ellipse(0, 6, radius * 0.9, radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Vest/Armor
        ctx.fillStyle = colors.vest;
        ctx.beginPath();
        ctx.arc(-2, 0, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Helmet (Head)
        ctx.fillStyle = colors.helmet;
        ctx.beginPath();
        ctx.arc(2, 0, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Visor (Eyes)
        ctx.fillStyle = colors.visor;
        ctx.beginPath();
        ctx.rect(4, -3, 4, 6);
        ctx.fill();
        
        // Gun (Simple rectangle indicating direction)
        ctx.fillStyle = '#111';
        ctx.fillRect(5, 4, 12, 3); // Gun barrel
        ctx.fillStyle = '#333';
        ctx.fillRect(2, 4, 4, 3);  // Grip area

        // Hands
        ctx.fillStyle = colors.body;
        ctx.beginPath(); ctx.arc(6, 6, 2.5, 0, Math.PI*2); ctx.fill(); // Right Hand
        ctx.beginPath(); ctx.arc(6, -2, 2.5, 0, Math.PI*2); ctx.fill(); // Left Hand helping

        ctx.restore();
    };

    // --- GAME CONTROL FUNCTIONS ---

    const startLevel = useCallback((level: number, diffMult: number) => {
        const config = generateLevel(level, diffMult);
        
        wallsRef.current = config.walls;
        decorationsRef.current = config.decorations;
        enemiesRef.current = config.enemies;
        lasersRef.current = config.lasers;
        powerupsRef.current = config.powerups;
        environmentRef.current = config.environment;
        
        playerRef.current.x = config.playerStart.x;
        playerRef.current.y = config.playerStart.y;
        playerRef.current.currentPath = [];
        playerRef.current.dead = false;
        playerRef.current.hp = playerRef.current.maxHp;
        // Reset effects but keep rpg stats
        playerRef.current.shield = 0;
        playerRef.current.activeEffects = { speed: 0, stealth: 0 };
        
        bulletsRef.current = [];
        particlesRef.current = [];
        ambientParticlesRef.current = [];
        
        initGrid();
        
        setGameState(prev => ({
            ...prev,
            currentLevel: level,
            enemiesRemaining: config.enemies.length,
            totalEnemies: config.enemies.length,
            status: 'playing',
            difficultyMultiplier: diffMult
        }));
        
        setPlayerStats(prev => ({...prev, hp: playerRef.current.maxHp}));
    }, [initGrid]);

    const nextLevel = () => {
        let diffMod = 0;
        const hp = playerRef.current.hp;
        if (hp > playerRef.current.maxHp * 0.9) diffMod = 0.2;
        else if (hp > playerRef.current.maxHp * 0.7) diffMod = 0.1;
        else if (hp < playerRef.current.maxHp * 0.3) diffMod = -0.05;

        const newDiff = Math.max(0.5, gameState.difficultyMultiplier + 0.05 + diffMod);
        
        const gainedCredits = CREDITS_PER_LEVEL_COMPLETE;

        setPlayerStats(prev => {
             const newXp = prev.xp + XP_PER_LEVEL_COMPLETE;
             const newCredits = prev.credits + gainedCredits;
             let newLevel = prev.level;
             let nextXp = prev.nextLevelXp;
             if (newXp >= nextXp) {
                 newLevel++;
                 nextXp = Math.floor(nextXp * 1.5);
             }
             
             // Update ref too
             playerRef.current.credits = newCredits;
             playerRef.current.xp = newXp;
             playerRef.current.level = newLevel;

             return { ...prev, xp: newXp, level: newLevel, nextLevelXp: nextXp, credits: newCredits };
        });

        startLevel(gameState.currentLevel + 1, newDiff);
    };

    const startGame = () => {
        setPlayerStats(prev => ({ ...prev, hp: INITIAL_PLAYER.maxHp }));
        startLevel(1, 1.0);
    };

    const startTutorial = () => {
        setTutorialStep(0);
        setGameState(prev => ({...prev, status: 'tutorial'}));
    };

    const finishTutorial = () => {
        localStorage.setItem('ha_tutorial_seen', 'true');
        setGameState(prev => ({...prev, status: 'menu'}));
    };

    const retryLevel = () => {
        startLevel(gameState.currentLevel, gameState.difficultyMultiplier);
    };

    const pauseGame = () => {
        if (gameState.status === 'playing') setGameState(prev => ({...prev, status: 'paused'}));
        else if (gameState.status === 'paused') setGameState(prev => ({...prev, status: 'playing'}));
    };

    const quitGame = () => {
        setGameState(prev => ({...prev, status: 'menu'}));
    };

    const openShop = () => {
        setShopSkinId(playerRef.current.selectedSkin);
        setGameState(prev => ({...prev, status: 'shop'}));
    }

    const buyOrEquipSkin = (skin: Skin) => {
        const p = playerRef.current;
        if (p.unlockedSkins.includes(skin.id)) {
            p.selectedSkin = skin.id;
            setShopSkinId(skin.id);
        } else {
            if (p.credits >= skin.cost) {
                p.credits -= skin.cost;
                p.unlockedSkins.push(skin.id);
                p.selectedSkin = skin.id;
                setShopSkinId(skin.id);
                setPlayerStats(prev => ({...prev, credits: p.credits}));
            }
        }
    };

    // --- JOYSTICK HANDLERS ---
    const handleJoystickStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        joystickRef.current = {
            active: true,
            angle: joystickRef.current.angle, 
            pointerId: e.pointerId
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handleJoystickMove = (e: React.PointerEvent) => {
        if (!joystickRef.current.active || e.pointerId !== joystickRef.current.pointerId) return;
        e.preventDefault();
        e.stopPropagation();

        // Calculate delta relative to PLAYER position (center of joystick)
        const deltaX = e.clientX - playerRef.current.x;
        const deltaY = e.clientY - playerRef.current.y;
        
        const dist = Math.sqrt(deltaX*deltaX + deltaY*deltaY);
        
        // Deadzone check
        if (dist > 10) {
            const angle = Math.atan2(deltaY, deltaX);
            joystickRef.current.angle = angle;
        }
    };

    const handleJoystickEnd = (e: React.PointerEvent) => {
        if (e.pointerId !== joystickRef.current.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        joystickRef.current.active = false;
    };

    // --- MAIN GAME LOOP ---
    const update = () => {
        if (gameState.status !== 'playing') return;

        const player = playerRef.current;
        const enemies = enemiesRef.current;
        const bullets = bulletsRef.current;
        const particles = particlesRef.current;
        const lasers = lasersRef.current;
        const powerups = powerupsRef.current;
        const env = environmentRef.current;
        const now = Date.now();
        
        if (damageTraumaRef.current > 0) {
            damageTraumaRef.current = Math.max(0, damageTraumaRef.current - 0.05);
        }

        // 0. Update Buffs
        if (player.activeEffects.speed > 0) player.activeEffects.speed -= 16.6; // ~1 frame at 60fps
        if (player.activeEffects.stealth > 0) player.activeEffects.stealth -= 16.6;

        const currentMoveSpeed = player.activeEffects.speed > 0 
            ? player.speed * POWERUP_SPEED_MULTIPLIER 
            : player.speed;

        // 0a. Ambient Particles
        if (env.temperature === 'cold' && Math.random() > 0.8) {
             ambientParticlesRef.current.push({
                 x: Math.random() * CANVAS_WIDTH,
                 y: -10,
                 vx: (Math.random() - 0.5) * 1,
                 vy: 1 + Math.random(),
                 life: 1.0,
                 color: '#fff',
                 type: 'snow',
                 size: Math.random() * 2 + 1
             });
        } else if (env.temperature === 'hot' && Math.random() > 0.9) {
            ambientParticlesRef.current.push({
                x: Math.random() * CANVAS_WIDTH,
                y: CANVAS_HEIGHT + 10,
                vx: (Math.random() - 0.5) * 1,
                vy: -0.5 - Math.random(),
                life: 1.0,
                color: '#ff6600',
                type: 'ember',
                size: Math.random() * 2
            });
        }

        // Update ambient particles
        for(let i = ambientParticlesRef.current.length - 1; i >= 0; i--) {
            let p = ambientParticlesRef.current[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.type === 'snow' && p.y > CANVAS_HEIGHT) p.life = 0;
            if (p.type === 'ember' && p.y < 0) p.life = 0;
            if (p.life <= 0) ambientParticlesRef.current.splice(i, 1);
        }

        // 0b. Powerups
        powerups.forEach(p => {
            if (!p.active) return;
            // Animation
            p.bobOffset = (p.bobOffset + 0.1) % (Math.PI * 2);
            
            // Collection
            if (dist(player.x, player.y, p.x, p.y) < player.radius + 15) {
                p.active = false;
                createParticles(p.x, p.y, '#FFF', 'heal', 20);
                
                // Effect
                switch (p.type) {
                    case 'medkit':
                        player.hp = Math.min(player.maxHp, player.hp + POWERUP_MEDKIT_HEAL);
                        setPlayerStats(prev => ({...prev, hp: player.hp}));
                        break;
                    case 'shield':
                        player.shield = Math.min(100, player.shield + POWERUP_SHIELD_AMOUNT);
                        break;
                    case 'speed':
                        player.activeEffects.speed = POWERUP_SPEED_DURATION;
                        break;
                    case 'stealth':
                        player.activeEffects.stealth = POWERUP_STEALTH_DURATION;
                        break;
                }
            }
        });

        // 0c. Hazards (Lasers)
        lasers.forEach(laser => {
             if (laser.active) {
                 if (rectOverlap({x: player.x - player.radius, y: player.y - player.radius, w: player.radius*2, h: player.radius*2}, laser)) {
                    let dmg = LASER_DAMAGE_PER_FRAME;
                    if (player.shield > 0) {
                        player.shield = Math.max(0, player.shield - dmg);
                        dmg = 0;
                    }
                    player.hp -= dmg;
                    damageTraumaRef.current = Math.max(damageTraumaRef.current, 0.15);
                     
                    setPlayerStats(prev => ({...prev, hp: Math.max(0, player.hp)}));
                    if (player.hp <= 0 && !player.dead) {
                        player.dead = true;
                        setGameState(prev => ({...prev, status: 'gameover'}));
                    }
                 }
             }
        });

        // 0d. Auto-Aim Logic
        let autoTarget: Enemy | null = null;
        let minAutoAimDist = PLAYER_RANGE;

        enemies.forEach(en => {
            if (!en.alive) return;
            const d = dist(player.x, player.y, en.x, en.y);
            if (d <= minAutoAimDist) {
                if (!isLineBlocked(player.x, player.y, en.x, en.y)) {
                    minAutoAimDist = d;
                    autoTarget = en;
                }
            }
        });

        // 1. Player Movement & Facing
        let moveAngle: number | null = null;
        if (player.currentPath.length > 0) {
            let target = player.currentPath[0];
            let dx = target.x - player.x;
            let dy = target.y - player.y;
            let distance = Math.sqrt(dx*dx + dy*dy);
            
            moveAngle = Math.atan2(dy, dx);

            if (distance > currentMoveSpeed) {
                player.x += (dx / distance) * currentMoveSpeed;
                player.y += (dy / distance) * currentMoveSpeed;
            } else {
                player.x = target.x;
                player.y = target.y;
                player.currentPath.shift();
            }
            
            // Leave dust trails if speeding
            if (player.activeEffects.speed > 0 && Math.random() > 0.5) {
                particlesRef.current.push({
                    x: player.x, y: player.y,
                    vx: 0, vy: 0, life: 0.3, color: '#ffff00', type: 'dust', size: 2
                });
            }
        }

        // Rotation Priority: Joystick > Auto-Aim > Movement Direction
        if (joystickRef.current.active) {
            player.angle = joystickRef.current.angle;
        } else if (autoTarget) {
            player.angle = Math.atan2(autoTarget.y - player.y, autoTarget.x - player.x);
        } else if (moveAngle !== null) {
            player.angle = moveAngle;
        }

        // 2. Player Shooting
        let nearestEnemy: Enemy | null = null;
        let nearestDist = Infinity;

        enemies.forEach(en => {
            if (!en.alive) return;
            const distToEnemy = dist(player.x, player.y, en.x, en.y);
            if (distToEnemy > PLAYER_RANGE) return;
            let angleToEnemy = Math.atan2(en.y - player.y, en.x - player.x);
            let viewDiff = Math.abs(angleToEnemy - player.angle);
            while (viewDiff > Math.PI) viewDiff -= Math.PI * 2;
            viewDiff = Math.abs(viewDiff);

            if (viewDiff < PLAYER_FOV / 2) {
                if (!isLineBlocked(player.x, player.y, en.x, en.y)) {
                    if (distToEnemy < nearestDist) {
                        nearestDist = distToEnemy;
                        nearestEnemy = en;
                    }
                }
            }
        });

        if (nearestEnemy && (now - player.lastShotTime > PLAYER_FIRE_RATE_MS)) {
            const en = nearestEnemy as Enemy;
            const angleToEnemy = Math.atan2(en.y - player.y, en.x - player.x);
            bulletsRef.current.push({
                x: player.x, y: player.y,
                vx: Math.cos(angleToEnemy) * BULLET_SPEED,
                vy: Math.sin(angleToEnemy) * BULLET_SPEED,
                speed: BULLET_SPEED, damage: PLAYER_BULLET_DAMAGE,
                ownerId: -1, isPlayerBullet: true
            });
            player.lastShotTime = now;
        }

        // 3. Enemies
        let activeEnemies = 0;
        enemies.forEach(en => {
            if (!en.alive) return;
            activeEnemies++;

            // --- ENRAGED LOGIC ---
            if (!en.enraged) {
                const hpPct = en.hp / en.maxHp;
                let thresh = 0.0;
                if (en.type === 'soldier') thresh = 0.5;
                else if (en.type === 'scout') thresh = 0.7;
                else if (en.type === 'sniper') thresh = 0.4;
                else if (en.type === 'heavy') thresh = 0.3;
                
                if (hpPct <= thresh) {
                    en.enraged = true;
                    en.speed = en.speed * 1.3;
                    createParticles(en.x, en.y, '#FF0000', 'smoke', 5);
                }
            }

            let pDist = dist(player.x, player.y, en.x, en.y);
            let angleToPlayer = Math.atan2(player.y - en.y, player.x - en.x);
            let viewDiff = Math.abs(angleToPlayer - en.angle);
            while (viewDiff > Math.PI) viewDiff -= Math.PI * 2;
            viewDiff = Math.abs(viewDiff);
            
            // STEALTH MODIFIER
            let effectiveFov = en.fov;
            let effectiveRange = en.range;
            if (player.activeEffects.stealth > 0) {
                effectiveFov *= 0.5;
                effectiveRange *= 0.6;
            }
            
            const canSeePlayer = (viewDiff < effectiveFov / 2 && pDist < effectiveRange) && !isLineBlocked(en.x, en.y, player.x, player.y);

            if (canSeePlayer) {
                en.state = 'attack';
                en.actualPath = []; 
                en.angle = angleToPlayer; 

                if (now - en.lastShotTime > FIRE_RATE_MS) {
                    bulletsRef.current.push({
                        x: en.x, y: en.y,
                        vx: Math.cos(en.angle) * BULLET_SPEED,
                        vy: Math.sin(en.angle) * BULLET_SPEED,
                        speed: BULLET_SPEED, damage: BULLET_DAMAGE,
                        ownerId: en.id, isPlayerBullet: false
                    });
                    en.lastShotTime = now;
                }
            } else {
                if (en.state === 'attack') en.state = 'wait';
                
                if (en.enraged && en.state !== 'attack' && player.activeEffects.stealth <= 0) {
                    const refreshRate = 500;
                    if (now - en.lastPathCalcTime > refreshRate || en.actualPath.length === 0) {
                        en.actualPath = findPath(en.x, en.y, player.x, player.y);
                        en.lastPathCalcTime = now;
                        en.state = 'move';
                    }
                    if (Math.random() > 0.8) {
                        particlesRef.current.push({ 
                            x: en.x + (Math.random()-0.5)*10, y: en.y - 15, 
                            vx: 0, vy: -1, life: 0.5, color: '#f00', type: 'smoke', size: 2 
                        });
                    }
                }

                if (en.state === 'init' || en.state === 'wait') {
                    if (en.state === 'wait') {
                        en.waitTime--;
                        if (en.waitTime > 0) return;
                    }
                    en.currentPatrolIdx++;
                    if (en.currentPatrolIdx >= en.patrolPoints.length) en.currentPatrolIdx = 0;
                    let finalDest = en.patrolPoints[en.currentPatrolIdx];
                    en.actualPath = findPath(en.x, en.y, finalDest.x, finalDest.y);
                    if(en.actualPath.length > 0) en.state = 'move';
                }
                
                if (en.state === 'move' && en.actualPath.length > 0) {
                    let target = en.actualPath[0];
                    let targetAngle = Math.atan2(target.y - en.y, target.x - en.x);
                    let angleDiff = targetAngle - en.angle;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    en.angle += angleDiff * 0.1; 
                    let d = dist(en.x, en.y, target.x, target.y);
                    if (Math.abs(angleDiff) < 1.5) {
                        if (d > en.speed) {
                            en.x += Math.cos(targetAngle) * en.speed;
                            en.y += Math.sin(targetAngle) * en.speed;
                        } else {
                            en.actualPath.shift();
                            if(en.actualPath.length === 0 && !en.enraged) { 
                                en.state = 'wait'; en.waitTime = 60; 
                            }
                        }
                    }
                }
            }
        });

        // 4. Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            const prevX = b.x;
            const prevY = b.y;
            b.x += b.vx;
            b.y += b.vy;
            
            // Wall Collision
            let hitWall: Wall | null = null;
            for (let w of wallsRef.current) {
                if (lineRect(prevX, prevY, b.x, b.y, w.x, w.y, w.w, w.h)) {
                    hitWall = w;
                    break;
                }
            }

            if (hitWall || b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) {
                if (hitWall && hitWall.type === 'barrel' && !hitWall.markedForDeletion) {
                    if (hitWall.hp !== undefined) {
                        hitWall.hp -= b.damage;
                        createParticles(hitWall.x + hitWall.w/2, hitWall.y + hitWall.h/2, '#F00', 'spark', 5);
                        if (hitWall.hp <= 0) {
                            hitWall.markedForDeletion = true;
                            triggerExplosion({x: hitWall.x + hitWall.w/2, y: hitWall.y + hitWall.h/2});
                        }
                    }
                }
                bullets.splice(i, 1);
                continue;
            }

            if (b.isPlayerBullet) {
                let hit = false;
                for(let en of enemies) {
                    if (!en.alive) continue;
                    if (dist(b.x, b.y, en.x, en.y) < (ENEMY_RADII[en.type] || 12) + 5) {
                        en.hp -= b.damage;
                        createParticles(en.x, en.y, ENEMY_COLORS[en.type] || '#ff0000');
                        if (en.hp <= 0) {
                            en.alive = false;
                            setPlayerStats(prev => {
                                const newXp = prev.xp + XP_PER_KILL;
                                const newCredits = prev.credits + CREDITS_PER_KILL;
                                let newLevel = prev.level;
                                let nextXp = prev.nextLevelXp;
                                if (newXp >= nextXp) {
                                    newLevel++;
                                    nextXp = Math.floor(nextXp * 1.5);
                                }
                                playerRef.current.credits = newCredits;
                                return { ...prev, xp: newXp, level: newLevel, nextLevelXp: nextXp, credits: newCredits };
                            });
                            setGameState(prev => ({...prev, enemiesRemaining: prev.enemiesRemaining - 1}));
                        }
                        hit = true; break;
                    }
                }
                if (hit) { bullets.splice(i, 1); continue; }
            } else {
                if (dist(b.x, b.y, player.x, player.y) < player.radius + 5) {
                    let dmg = b.damage;
                    
                    if (player.shield > 0) {
                        if (player.shield >= dmg) {
                            player.shield -= dmg;
                            dmg = 0;
                            createParticles(player.x, player.y, '#00ffff', 'spark', 5); // Shield Hit Effect
                        } else {
                            dmg -= player.shield;
                            player.shield = 0;
                        }
                    }

                    player.hp -= dmg;
                    const intensity = b.damage > 15 ? 0.8 : 0.4;
                    damageTraumaRef.current = Math.min(2.0, damageTraumaRef.current + intensity);

                    if (dmg > 0) createParticles(player.x, player.y, '#FF0000'); 
                    
                    bullets.splice(i, 1);
                    setPlayerStats(prev => ({...prev, hp: Math.max(0, player.hp)}));
                    if (player.hp <= 0) {
                        player.dead = true;
                        setGameState(prev => ({...prev, status: 'gameover'}));
                    }
                    continue;
                }
            }
        }

        if (wallsRef.current.some(w => w.markedForDeletion)) {
            wallsRef.current = wallsRef.current.filter(w => !w.markedForDeletion);
            initGrid();
        }

        if (activeEnemies === 0) {
             setGameState(prev => ({...prev, status: 'victory'}));
        }

        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i]; 
            p.x += p.vx; p.y += p.vy; 
            if (p.type === 'shockwave') {
                p.size! += 8;
                p.life -= 0.1;
            } else if (p.type === 'heal') {
                p.y -= 1; // Float up
                p.life -= 0.03;
            } else {
                p.life -= 0.05;
            }
            if(p.life <= 0) particles.splice(i, 1);
        }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const env = environmentRef.current;
        const player = playerRef.current;
        // Background
        ctx.fillStyle = env.bgColor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.save();
        if (damageTraumaRef.current > 0) {
            const shake = Math.pow(damageTraumaRef.current, 2) * 12;
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        // Floor Grid
        ctx.strokeStyle = env.gridColor; ctx.lineWidth = 1;
        for(let i=0; i<CANVAS_WIDTH; i+=GRID_SIZE) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,CANVAS_HEIGHT); ctx.stroke(); }
        for(let i=0; i<CANVAS_HEIGHT; i+=GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(CANVAS_WIDTH,i); ctx.stroke(); }

        // Decorations
        decorationsRef.current.forEach(d => {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.scale(d.scale, d.scale);
            ctx.fillStyle = d.color;
            if (d.type === 'litter') {
                ctx.beginPath(); ctx.rect(-5, -5, 10, 8); ctx.fill();
            } else if (d.type === 'crack') {
                ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-2, 2); ctx.lineTo(5, -5); ctx.lineTo(10, 0); ctx.stroke();
            } else if (d.type === 'rubble') {
                ctx.beginPath(); ctx.arc(0,0, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(6,2, 3, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.globalAlpha = 0.3;
                ctx.beginPath(); ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            ctx.restore();
        });

        // Powerups
        powerupsRef.current.forEach(p => {
            if (!p.active) return;
            ctx.save();
            ctx.translate(p.x, p.y + Math.sin(p.bobOffset) * 5); // Bobbing effect
            
            // Glow
            ctx.shadowBlur = 15;
            
            if (p.type === 'medkit') {
                ctx.shadowColor = '#4caf50';
                ctx.fillStyle = '#fff';
                ctx.fillRect(-8, -8, 16, 16);
                ctx.fillStyle = '#4caf50';
                ctx.fillRect(-3, -6, 6, 12); ctx.fillRect(-6, -3, 12, 6); // Cross
            } else if (p.type === 'shield') {
                ctx.shadowColor = '#00e5ff';
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0,0, 8, 0, Math.PI*2); ctx.stroke();
                ctx.fillStyle = 'rgba(0, 229, 255, 0.5)'; ctx.fill();
            } else if (p.type === 'speed') {
                ctx.shadowColor = '#ffd600';
                ctx.fillStyle = '#ffd600';
                ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(6, -2); ctx.lineTo(-2, 2); ctx.lineTo(4, 6); ctx.lineTo(-6, 2); ctx.lineTo(2, -2); ctx.fill();
            } else if (p.type === 'stealth') {
                ctx.shadowColor = '#d500f9';
                ctx.fillStyle = '#d500f9';
                ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
            }
            ctx.restore();
        });

        // Lasers
        lasersRef.current.forEach(l => {
             if (!l.active) return;
             ctx.save();
             ctx.shadowBlur = 10;
             ctx.shadowColor = '#00ffff';
             ctx.fillStyle = 'rgba(200, 255, 255, 0.8)';
             ctx.fillRect(l.x, l.y, l.w, l.h);
             ctx.fillStyle = '#fff';
             if (l.axis === 'x') ctx.fillRect(l.x, l.y + l.h/2 - 1, l.w, 2);
             else ctx.fillRect(l.x + l.w/2 - 1, l.y, 2, l.h);
             ctx.restore();
        });

        // Path
        if (playerRef.current.currentPath.length > 0 && !playerRef.current.dead) {
            ctx.beginPath(); ctx.moveTo(playerRef.current.x, playerRef.current.y);
            for(let point of playerRef.current.currentPath) { ctx.lineTo(point.x, point.y); }
            ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
            let last = playerRef.current.currentPath[playerRef.current.currentPath.length-1];
            ctx.beginPath(); ctx.arc(last.x, last.y, 6, 0, Math.PI*2); ctx.fillStyle = '#ff6600'; ctx.fill();
        }

        // Walls
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        wallsRef.current.forEach(w => ctx.fillRect(w.x + 8, w.y + 8, w.w, w.h));
        
        wallsRef.current.forEach(w => {
            const {x, y, w: width, h, type} = w;
            ctx.save();
            if (type === 'container') {
                ctx.beginPath(); ctx.rect(x, y, width, h); ctx.clip();
                ctx.fillStyle = '#37474f'; ctx.fillRect(x, y, width, h);
                ctx.fillStyle = '#263238'; 
                for(let i = x + 5; i < x + width; i += 20) { 
                    ctx.fillRect(i, y, 10, h); ctx.fillStyle = '#455a64'; ctx.fillRect(i, y, 2, h); ctx.fillStyle = '#263238'; 
                }
                ctx.strokeStyle = '#102027'; ctx.lineWidth = 4; ctx.strokeRect(x,y,width,h);
                ctx.fillStyle = '#cfd8dc'; ctx.fillRect(x + width/2 - 2, y + h/2 - 8, 4, 16);
            } else if (type === 'wall') {
                ctx.fillStyle = '#616161'; ctx.fillRect(x, y, width, h);
                ctx.fillStyle = '#757575'; ctx.fillRect(x, y, width, 4); 
                ctx.fillStyle = '#424242'; ctx.fillRect(x, y + h - 4, width, 4);
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+width, y+h); ctx.strokeStyle = '#555'; ctx.stroke();
                ctx.strokeStyle = '#212121'; ctx.lineWidth = 2; ctx.strokeRect(x,y,width,h);
            } else if (type === 'pillar') {
                ctx.fillStyle = '#212121'; ctx.fillRect(x, y, width, h); 
                ctx.fillStyle = '#424242'; ctx.fillRect(x+4, y+4, width-8, h-8);
                ctx.strokeStyle = '#000'; ctx.lineWidth = 2; 
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+width, y+h); ctx.moveTo(x+width, y); ctx.lineTo(x, y+h); ctx.stroke();
            } else if (type === 'drum') {
                const cx = x + width/2; const cy = y + h/2; const r = width/2;
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = '#1565c0'; ctx.fill(); 
                ctx.lineWidth = 2; ctx.strokeStyle = '#0d47a1'; ctx.stroke();
                ctx.beginPath(); ctx.arc(cx, cy, r*0.7, 0, Math.PI*2); ctx.stroke(); 
            } else if (type === 'barrel') {
                const cx = x + width/2; const cy = y + h/2; const r = width/2;
                const hpRatio = (w.hp || 1) / (w.maxHp || 1);
                const redVal = Math.floor(211 * hpRatio); const otherVal = Math.floor(47 * hpRatio);
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = `rgb(${redVal}, ${otherVal}, ${otherVal})`; ctx.fill(); 
                ctx.lineWidth = 2; ctx.strokeStyle = '#b71c1c'; ctx.stroke();
                ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.rect(x + 2, y + h/2 - 5, width-4, 10); ctx.fill();
                ctx.fillStyle = 'black'; ctx.font = '10px Arial'; ctx.fillText('!', cx - 2, cy + 4);
                if (hpRatio < 0.8) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 8, cy - 8);
                    if (hpRatio < 0.5) { ctx.moveTo(cx, cy); ctx.lineTo(cx - 8, cy + 6); }
                    if (hpRatio < 0.25) { ctx.moveTo(cx, cy); ctx.lineTo(cx + 6, cy + 8); }
                    ctx.stroke();
                }
            } else if (type === 'treasure') {
                ctx.fillStyle = '#fbc02d'; ctx.fillRect(x, y, width, h);
                ctx.strokeStyle = '#f57f17'; ctx.lineWidth = 3; ctx.strokeRect(x,y,width,h);
                ctx.fillStyle = '#f57f17'; ctx.fillRect(x, y+h/3, width, h/3);
                ctx.fillStyle = '#eceff1'; ctx.fillRect(x + width/2 - 4, y + h/2 - 4, 8, 8);
            } else { 
                ctx.fillStyle = '#5d4037'; ctx.fillRect(x, y, width, h);
                ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2; ctx.strokeRect(x,y,width,h);
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+width, y+h); ctx.moveTo(x+width, y); ctx.lineTo(x, y+h); ctx.stroke();
                ctx.strokeRect(x+4, y+4, width-8, h-8);
            }
            ctx.restore();
        });

        // Enemies
        enemiesRef.current.forEach(en => {
            if (!en.alive) { 
                ctx.fillStyle = '#330000'; 
                ctx.beginPath(); ctx.arc(en.x, en.y, ENEMY_RADII[en.type] || 10, 0, Math.PI*2); ctx.fill(); 
                return; 
            }
            let grad = ctx.createRadialGradient(en.x, en.y, 10, en.x, en.y, en.range);
            let color = en.state === 'attack' ? '255, 50, 50' : '255, 200, 50';
            if (en.type === 'sniper' && en.state !== 'attack') color = '150, 100, 255';
            if (en.enraged) color = '255, 0, 0';

            grad.addColorStop(0, `rgba(${color}, 0.4)`); grad.addColorStop(1, `rgba(${color}, 0.0)`);
            ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(en.x, en.y);
            ctx.arc(en.x, en.y, en.range, en.angle - en.fov/2, en.angle + en.fov/2); ctx.closePath(); ctx.fill();
            
            const radius = ENEMY_RADII[en.type] || 12;
            const healthPct = en.hp / en.maxHp;
            const baseColor = ENEMY_COLORS[en.type] || '#d32f2f';
            const enemyColors = {
                body: en.enraged ? '#ff0000' : baseColor, 
                helmet: '#111',
                visor: en.state === 'attack' || en.enraged ? '#ff0000' : '#ffff00',
                vest: '#222'
            };
            drawSprite(ctx, en.x, en.y, en.angle, radius, enemyColors, true);
            
            if (en.enraged) {
                ctx.fillStyle = 'red'; ctx.font = 'bold 16px Arial'; ctx.fillText('!', en.x - 4, en.y - 20);
            }

            ctx.save();
            ctx.beginPath(); ctx.arc(en.x, en.y, radius, 0, Math.PI*2); ctx.clip();
            const fillHeight = (radius * 2) * healthPct;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; 
            ctx.fillRect(en.x - radius, en.y - radius, radius * 2, radius * 2);
            ctx.fillStyle = `rgba(0,0,0, ${1 - healthPct})`; 
            ctx.fillRect(en.x - radius, en.y - radius, radius * 2, (radius * 2) - fillHeight);
            ctx.restore();
        });

        // Bullets
        bulletsRef.current.forEach(b => {
            ctx.fillStyle = b.isPlayerBullet ? '#ffff00' : '#fff';
            ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 5; ctx.shadowColor = b.isPlayerBullet ? 'orange' : 'white'; ctx.fill(); ctx.shadowBlur = 0;
        });

        // Player
        const p = playerRef.current;
        if (!p.dead) {
            // Vision
            ctx.save();
            let pGrad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, PLAYER_RANGE);
            pGrad.addColorStop(0, 'rgba(100, 255, 100, 0.15)'); pGrad.addColorStop(1, 'rgba(100, 255, 100, 0.0)');
            ctx.fillStyle = pGrad; ctx.beginPath(); ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, PLAYER_RANGE, p.angle - PLAYER_FOV/2, p.angle + PLAYER_FOV/2); ctx.closePath(); ctx.fill();
            ctx.restore();

            // Active Buff Visuals
            if (p.activeEffects.stealth > 0) {
                ctx.globalAlpha = 0.5; // Ghostly
            }

            // Sprite
            const currentSkin = SKINS.find(s => s.id === p.selectedSkin) || SKINS[0];
            drawSprite(ctx, p.x, p.y, p.angle, p.radius, currentSkin.colors, false);
            ctx.globalAlpha = 1.0;

            // Shield Overlay
            if (p.shield > 0) {
                ctx.save();
                ctx.strokeStyle = `rgba(0, 229, 255, ${p.shield / 100})`;
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 5;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI*2); ctx.stroke();
                ctx.restore();
            }

            // --- SYNC JOYSTICK DOM ELEMENT ---
            if (joystickContainerRef.current) {
                const jsSize = 100;
                joystickContainerRef.current.style.transform = `translate(${p.x - jsSize/2}px, ${p.y - jsSize/2}px)`;
                if (joystickKnobRef.current) {
                    if (joystickRef.current.active) {
                        const dist = 25; 
                        const kx = Math.cos(joystickRef.current.angle) * dist;
                        const ky = Math.sin(joystickRef.current.angle) * dist;
                        joystickKnobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
                        joystickKnobRef.current.style.opacity = '1';
                        joystickContainerRef.current.style.opacity = '0.2';
                    } else {
                        joystickKnobRef.current.style.transform = `translate(0px, 0px)`;
                        joystickKnobRef.current.style.opacity = '0'; 
                        joystickContainerRef.current.style.opacity = '0'; 
                    }
                }
            }
        }

        ambientParticlesRef.current.forEach(pt => {
            ctx.save();
            ctx.fillStyle = pt.color;
            ctx.globalAlpha = pt.life;
            ctx.beginPath(); 
            ctx.arc(pt.x, pt.y, pt.size || 2, 0, Math.PI*2); 
            ctx.fill();
            ctx.restore();
        });

        particlesRef.current.forEach(pt => { 
            ctx.save();
            if (pt.type === 'shockwave') {
                ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size || 10, 0, Math.PI*2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${pt.life})`; ctx.lineWidth = 3; ctx.stroke();
            } else if (pt.type === 'heal') {
                ctx.fillStyle = '#4caf50'; ctx.globalAlpha = pt.life;
                ctx.font = '12px Arial'; ctx.fillText('+', pt.x, pt.y);
            } else {
                ctx.fillStyle = pt.color; ctx.globalAlpha = pt.life;
                ctx.beginPath(); ctx.arc(pt.x, pt.y, (pt.type === 'fire' ? 4 : 2), 0, Math.PI*2); ctx.fill(); 
            }
            ctx.restore();
        });

        if (env.overlayColor !== 'transparent') {
            ctx.fillStyle = env.overlayColor;
            ctx.fillRect(0,0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        ctx.restore();
        if (damageTraumaRef.current > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${damageTraumaRef.current * 0.3})`;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
    };

    const handleInput = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if(gameState.status !== 'playing') return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        let clickX = (e.clientX - rect.left) * scaleX;
        let clickY = (e.clientY - rect.top) * scaleY;
        let newPath = findPath(playerRef.current.x, playerRef.current.y, clickX, clickY);
        if(newPath.length > 0) playerRef.current.currentPath = newPath;
    };

    useEffect(() => {
        initGrid();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const loop = () => {
            update();
            draw(ctx);
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [initGrid, gameState.status, gameState.currentLevel, playerRef.current.selectedSkin]);

    // --- UI STYLES ---
    const slantClass = "transform -skew-x-12";
    const uiContainerClass = "absolute inset-0 pointer-events-none p-4 flex flex-col justify-between";
    const barContainer = "h-4 bg-black/50 border border-white/30 rounded-sm overflow-hidden";

    return (
        <div className="relative w-full h-full bg-zinc-800 select-none">
            
            <canvas 
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onClick={handleInput}
                className="cursor-crosshair bg-zinc-900 block"
                style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` }}
            />

            {/* --- IN-GAME HUD --- */}
            {gameState.status === 'playing' || gameState.status === 'paused' ? (
                <>
                <div className={uiContainerClass}>
                    {/* Top Header */}
                    <div className="flex justify-between items-start z-10">
                        {/* Target Counter */}
                        <div className={`bg-red-600 text-white px-6 py-2 border-l-4 border-white ${slantClass} shadow-lg shadow-red-900/50`}>
                            <div className="transform skew-x-12">
                                <h2 className="text-2xl font-black italic tracking-tighter">TARGETS</h2>
                                <p className="text-xl font-bold">{gameState.enemiesRemaining} <span className="text-sm opacity-70">/ {gameState.totalEnemies}</span></p>
                            </div>
                        </div>
                        {/* Level Indicator */}
                        <div className={`bg-yellow-500 text-black px-4 py-1 border-r-4 border-white ${slantClass} shadow-lg`}>
                            <div className="transform skew-x-12 text-right">
                                <p className="font-black text-lg">MISSION {gameState.currentLevel}</p>
                                <p className="text-xs font-bold uppercase opacity-80">Credits: ${playerStats.credits}</p>
                                <p className="text-[10px] font-bold uppercase opacity-60">
                                    {environmentRef.current.temperature.toUpperCase()} | {environmentRef.current.timeOfDay.toUpperCase()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Status */}
                    <div className="flex justify-between items-end z-10 w-full gap-4">
                        {/* HP & XP */}
                        <div className="flex-1 max-w-[200px] space-y-2">
                            {/* HP & Shield */}
                            <div className="relative">
                                <div className="flex justify-between">
                                    <p className="text-xs font-bold text-green-400 mb-0.5 ml-1 italic">VITALITY</p>
                                    {playerRef.current.shield > 0 && <span className="text-xs font-bold text-cyan-400 animate-pulse">SHIELD ACTIVE</span>}
                                </div>
                                <div className={barContainer}>
                                    <div className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300" 
                                         style={{width: `${(playerStats.hp / playerRef.current.maxHp) * 100}%`}} />
                                    {/* Shield Overlay Bar */}
                                    {playerRef.current.shield > 0 && (
                                        <div className="absolute top-0 left-0 h-full bg-cyan-400/50 border-r-2 border-cyan-200 transition-all duration-300"
                                            style={{width: `${Math.min(100, playerRef.current.shield)}%`}} />
                                    )}
                                </div>
                                <span className="absolute right-1 top-4 text-[10px] text-white/80">{Math.ceil(playerStats.hp)}</span>
                            </div>
                            {/* XP */}
                            <div className="relative">
                                <div className="flex justify-between text-xs font-bold text-blue-400 mb-0.5 ml-1 italic">
                                    <span>OPERATIVE RANK {playerStats.level}</span>
                                </div>
                                <div className={`${barContainer} h-2 border-blue-500/30`}>
                                    <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500" 
                                         style={{width: `${(playerStats.xp / playerStats.nextLevelXp) * 100}%`}} />
                                </div>
                            </div>
                            
                            {/* Active Effects Display */}
                            <div className="flex gap-2 min-h-[20px]">
                                {playerRef.current.activeEffects.speed > 0 && (
                                    <span className="text-[10px] font-bold bg-yellow-500/80 text-black px-1 rounded">SPD</span>
                                )}
                                {playerRef.current.activeEffects.stealth > 0 && (
                                    <span className="text-[10px] font-bold bg-purple-500/80 text-white px-1 rounded">STL</span>
                                )}
                            </div>
                        </div>
                        
                        {/* Pause Button */}
                        <button onClick={pauseGame} className={`pointer-events-auto bg-white/10 hover:bg-white/20 p-2 rounded border border-white/20 backdrop-blur-sm transition`}>
                            <div className="space-x-1 flex">
                                <div className="w-2 h-6 bg-white"></div>
                                <div className="w-2 h-6 bg-white"></div>
                            </div>
                        </button>
                    </div>
                </div>
                
                {/* --- JOYSTICK (ON PLAYER) --- */}
                <div 
                    ref={joystickContainerRef}
                    className="absolute top-0 left-0 w-[100px] h-[100px] rounded-full bg-white/50 border-2 border-white/50 backdrop-blur-sm z-20 pointer-events-auto touch-none flex items-center justify-center transition-opacity duration-200 opacity-0"
                    onPointerDown={handleJoystickStart}
                    onPointerMove={handleJoystickMove}
                    onPointerUp={handleJoystickEnd}
                    onPointerCancel={handleJoystickEnd}
                    onPointerLeave={handleJoystickEnd}
                    style={{ transform: 'translate(-999px, -999px)' }} // Initial off-screen
                >
                    <div 
                        ref={joystickKnobRef}
                        className="w-12 h-12 rounded-full bg-white shadow-lg pointer-events-none opacity-0 transition-transform duration-75 ease-linear"
                    ></div>
                </div>
                </>
            ) : null}

            {/* --- TUTORIAL OVERLAY --- */}
            {gameState.status === 'tutorial' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 backdrop-blur-md p-4">
                    <div className="w-full max-w-md bg-zinc-800 border-2 border-white/20 shadow-2xl overflow-hidden relative">
                        <div className="bg-gradient-to-r from-red-900 to-black p-4 border-b border-white/10">
                             <h2 className="text-2xl font-black italic text-white flex items-center gap-2">
                                <span className="text-3xl">{TUTORIAL_SLIDES[tutorialStep].icon}</span>
                                {TUTORIAL_SLIDES[tutorialStep].title}
                             </h2>
                        </div>
                        
                        <div className="p-8 min-h-[250px] flex flex-col justify-center">
                            {TUTORIAL_SLIDES[tutorialStep].isPowerupSlide ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500"></div><span className="text-sm font-bold">MEDKIT</span></div>
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-cyan-400 border border-cyan-200 rounded-full"></div><span className="text-sm font-bold">SHIELD</span></div>
                                    <div className="flex items-center gap-2"><div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-transparent border-b-yellow-400"></div><span className="text-sm font-bold">SPEED</span></div>
                                    <div className="flex items-center gap-2"><div className="w-4 h-3 rounded-full bg-purple-500"></div><span className="text-sm font-bold">STEALTH</span></div>
                                    <p className="col-span-2 text-zinc-400 text-sm mt-4 italic">Collect supply crates to gain temporary advantages.</p>
                                </div>
                            ) : (
                                <p className="text-lg whitespace-pre-wrap leading-relaxed text-zinc-200">
                                    {TUTORIAL_SLIDES[tutorialStep].content}
                                </p>
                            )}
                        </div>

                        {/* Pagination Dots */}
                        <div className="flex justify-center gap-2 mb-4">
                            {TUTORIAL_SLIDES.map((_, i) => (
                                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === tutorialStep ? 'bg-red-500' : 'bg-zinc-600'}`}></div>
                            ))}
                        </div>

                        <div className="p-4 bg-black/40 border-t border-white/10 flex justify-between">
                            <button 
                                onClick={() => tutorialStep > 0 ? setTutorialStep(s => s-1) : finishTutorial()} 
                                className="px-4 py-2 text-zinc-400 font-bold hover:text-white"
                            >
                                {tutorialStep === 0 ? 'SKIP' : 'BACK'}
                            </button>
                            
                            <button 
                                onClick={() => {
                                    if(tutorialStep < TUTORIAL_SLIDES.length - 1) setTutorialStep(s => s+1);
                                    else finishTutorial();
                                }} 
                                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black skew-x-[-10deg] transition-colors"
                            >
                                {tutorialStep === TUTORIAL_SLIDES.length - 1 ? 'START MISSION' : 'NEXT'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MENUS --- */}
            
            {/* Main Menu */}
            {gameState.status === 'menu' && (
                <div className="absolute inset-0 bg-zinc-900/90 flex flex-col items-center justify-center z-50">
                    <div className={`${slantClass} bg-red-600 p-8 border-4 border-white mb-8 shadow-2xl shadow-red-500/20`}>
                        <h1 className="transform skew-x-12 text-6xl font-black italic tracking-tighter text-white">
                            HUNTER<br/><span className="text-black">ASSASSIN</span>
                        </h1>
                    </div>
                    <div className="flex flex-col gap-4">
                        <button onClick={startGame} className="group pointer-events-auto relative px-8 py-4 bg-transparent overflow-hidden border-2 border-white text-white font-black italic text-2xl hover:text-black transition-colors duration-300 w-64">
                            <div className="absolute inset-0 w-0 bg-white transition-all duration-[250ms] ease-out group-hover:w-full"></div>
                            <span className="relative">START MISSION</span>
                        </button>
                        <button onClick={openShop} className="group pointer-events-auto relative px-8 py-4 bg-transparent overflow-hidden border-2 border-yellow-500 text-yellow-500 font-black italic text-2xl hover:text-black transition-colors duration-300 w-64">
                            <div className="absolute inset-0 w-0 bg-yellow-500 transition-all duration-[250ms] ease-out group-hover:w-full"></div>
                            <span className="relative">ARMORY SHOP</span>
                        </button>
                        <button onClick={startTutorial} className="group pointer-events-auto relative px-8 py-2 bg-transparent overflow-hidden border border-zinc-500 text-zinc-400 font-bold text-sm hover:text-white transition-colors duration-300 w-64 mt-4">
                            <div className="absolute inset-0 w-0 bg-zinc-700 transition-all duration-[250ms] ease-out group-hover:w-full"></div>
                            <span className="relative">HOW TO PLAY</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Shop */}
            {gameState.status === 'shop' && (
                <div className="absolute inset-0 bg-zinc-900 flex flex-col z-50 overflow-hidden">
                     <div className="p-4 bg-black border-b border-white/20 flex justify-between items-center">
                        <h2 className="text-3xl font-black italic text-yellow-500">ARMORY</h2>
                        <div className="text-right">
                            <p className="text-sm text-zinc-400">AVAILABLE CREDITS</p>
                            <p className="text-2xl font-bold text-green-400">${playerStats.credits}</p>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start">
                        {SKINS.map(skin => {
                            const isUnlocked = playerRef.current.unlockedSkins.includes(skin.id);
                            const isSelected = playerRef.current.selectedSkin === skin.id;
                            const canAfford = playerRef.current.credits >= skin.cost;
                            
                            return (
                                <div key={skin.id} className={`bg-zinc-800 p-4 border-2 ${isSelected ? 'border-green-500 bg-green-900/10' : 'border-zinc-700'} rounded-lg flex flex-col gap-2 relative overflow-hidden group`}>
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-lg">{skin.name}</h3>
                                        <div className="w-8 h-8 rounded-full border-2 border-white/30" style={{backgroundColor: skin.colors.body}}></div>
                                    </div>
                                    <p className="text-xs text-zinc-400 mb-2">{skin.description}</p>
                                    
                                    <div className="mt-auto">
                                        {isUnlocked ? (
                                            <button 
                                                onClick={() => buyOrEquipSkin(skin)}
                                                className={`w-full py-2 font-bold text-sm uppercase ${isSelected ? 'bg-green-600 text-white cursor-default' : 'bg-white text-black hover:bg-zinc-200'}`}
                                            >
                                                {isSelected ? 'EQUIPPED' : 'EQUIP'}
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => buyOrEquipSkin(skin)}
                                                disabled={!canAfford}
                                                className={`w-full py-2 font-bold text-sm uppercase flex justify-between px-4 ${canAfford ? 'bg-yellow-600 text-white hover:bg-yellow-500' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'}`}
                                            >
                                                <span>BUY</span>
                                                <span>${skin.cost}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                     </div>
                     <button onClick={quitGame} className="p-4 bg-zinc-800 border-t border-white/20 hover:bg-zinc-700 text-white font-bold text-center">
                        BACK TO MENU
                     </button>
                </div>
            )}

            {/* Victory Screen */}
            {gameState.status === 'victory' && (
                <div className="absolute inset-0 bg-green-900/90 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                    <h2 className="text-6xl font-black italic text-white mb-2 drop-shadow-lg">MISSION CLEAR</h2>
                    <div className="bg-black/40 p-6 rounded border border-white/10 mb-8 text-center w-64">
                        <div className="flex justify-between mb-2">
                             <span className="text-blue-400 font-bold">XP</span>
                             <span className="text-white">+{XP_PER_LEVEL_COMPLETE}</span>
                        </div>
                        <div className="flex justify-between mb-4">
                             <span className="text-green-400 font-bold">CREDITS</span>
                             <span className="text-white">+${CREDITS_PER_LEVEL_COMPLETE}</span>
                        </div>
                        <div className="w-full bg-zinc-700 h-1 mb-4"></div>
                        <p className="text-zinc-400 text-sm">NEXT THREAT LEVEL</p>
                        <p className="text-xl font-bold text-yellow-500">{(gameState.difficultyMultiplier + 0.1).toFixed(1)}x</p>
                    </div>
                    <button onClick={nextLevel} className="pointer-events-auto px-10 py-4 bg-white text-green-900 font-black text-xl hover:scale-105 transition-transform skew-x-[-10deg]">
                        NEXT OPERATION &rarr;
                    </button>
                </div>
            )}

            {/* Game Over Screen */}
            {gameState.status === 'gameover' && (
                <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                    <h2 className="text-6xl font-black italic text-white mb-6 tracking-widest">K.I.A.</h2>
                    <p className="text-red-400 font-bold mb-8">OPERATION FAILED</p>
                    <div className="flex gap-4">
                        <button onClick={retryLevel} className="pointer-events-auto px-8 py-3 border-2 border-white text-white font-bold hover:bg-white hover:text-red-900 transition">
                            RETRY LEVEL
                        </button>
                        <button onClick={quitGame} className="pointer-events-auto px-8 py-3 bg-red-800 text-white font-bold hover:bg-red-700 transition">
                            ABORT
                        </button>
                    </div>
                </div>
            )}

            {/* Pause Menu */}
            {gameState.status === 'paused' && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur flex flex-col items-center justify-center z-50">
                    <h2 className="text-4xl font-black italic text-white mb-8">SYSTEM PAUSED</h2>
                    <div className="flex flex-col gap-4 w-48">
                        <button onClick={pauseGame} className="pointer-events-auto py-3 bg-white text-black font-bold hover:translate-x-2 transition-transform skew-x-[-10deg]">
                            RESUME
                        </button>
                        <button onClick={quitGame} className="pointer-events-auto py-3 bg-transparent border border-white text-white font-bold hover:translate-x-2 transition-transform skew-x-[-10deg]">
                            QUIT TO MENU
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}