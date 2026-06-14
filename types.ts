
export interface Point {
    x: number;
    y: number;
}

export type WallType = 'crate' | 'container' | 'wall' | 'pillar' | 'drum' | 'treasure' | 'barrel' | 'terminal' | 'ai_core';

export interface Wall {
    id?: number; // Unique ID for identifying specific walls (like barrels)
    x: number;
    y: number;
    w: number;
    h: number;
    type: WallType;
    hp?: number;     // For destructible walls like barrels
    maxHp?: number;
    markedForDeletion?: boolean; // For cleanup after explosion
    hacked?: boolean; // For encrypted terminals
}

export interface Decoration {
    x: number;
    y: number;
    type: 'litter' | 'crack' | 'rubble' | 'stain';
    rotation: number;
    scale: number;
    color: string;
}

export interface Laser {
    x: number;
    y: number;
    w: number;
    h: number;
    active: boolean;
    // Orientation helper
    axis: 'x' | 'y'; 
}

export type PowerupType = 'medkit' | 'speed' | 'shield' | 'stealth';

export interface Powerup {
    id: number;
    x: number;
    y: number;
    type: PowerupType;
    active: boolean; // false if picked up
    bobOffset: number; // For visual animation
}

export interface Player {
    x: number;
    y: number;
    angle: number; 
    radius: number;
    speed: number;
    dead: boolean;
    currentPath: Point[];
    hp: number;
    maxHp: number;
    lastShotTime: number;
    // RPG Stats
    xp: number;
    level: number;
    nextLevelXp: number;
    knowledge: number; // Knowledge score from 0 to 1000 representing Turing awareness
    // Economy & Cosmetics
    credits: number;
    unlockedSkins: string[]; // List of skin IDs
    selectedSkin: string;    // Current Skin ID
    // Active Buffs
    shield: number;
    activeEffects: {
        speed: number;   // Time remaining in ms
        stealth: number; // Time remaining in ms
    };
}

export interface Skin {
    id: string;
    name: string;
    cost: number;
    description: string;
    colors: {
        body: string;
        helmet: string;
        visor: string;
        vest: string;
    };
}

export interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    speed: number;
    damage: number;
    ownerId: number; 
    isPlayerBullet: boolean; 
}

export type EnemyType = 'soldier' | 'scout' | 'sniper' | 'heavy';

export interface Enemy {
    id: number;
    x: number;
    y: number;
    angle: number;
    range: number;
    fov: number;
    alive: boolean;
    patrolPoints: Point[];
    currentPatrolIdx: number;
    actualPath: Point[];
    speed: number;
    waitTime: number;
    state: 'init' | 'move' | 'wait' | 'alert' | 'attack';
    lastShotTime: number;
    type: EnemyType;
    hp: number;
    maxHp: number;
    // New traits
    enraged: boolean;
    lastPathCalcTime: number;
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    type?: 'smoke' | 'fire' | 'spark' | 'shockwave' | 'snow' | 'ember' | 'dust' | 'heal' | 'buff'; // Extended particle types
    size?: number;
}

export interface GameState {
    currentLevel: number;
    enemiesRemaining: number;
    totalEnemies: number;
    status: 'menu' | 'shop' | 'playing' | 'paused' | 'victory' | 'gameover' | 'tutorial' | 'deleted';
    difficultyMultiplier: number; // 1.0 is standard
    solsticeTimeProgress: number; // Ticks up during level (0 to 1, moving DAWN -> NIGHT)
    activeBriefing?: string;
    hackedTuringQuotes: string[];
}

export type SolsticePhase = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'sunset' | 'night';
export type SolsticeModifier = 'Golden Dawn' | 'High Noon' | 'Crimson Sunset' | 'Eclipse Event';
export type Temperature = 'normal' | 'hot' | 'cold';

export interface Environment {
    solsticePhase: SolsticePhase;
    solsticeModifier: SolsticeModifier;
    temperature: Temperature;
    bgColor: string;      // Floor background color
    gridColor: string;    // Grid line color
    overlayColor: string; // Time of day tint (rgba)
}

export interface LevelConfig {
    walls: Wall[];
    decorations: Decoration[];
    enemies: Enemy[];
    lasers: Laser[];
    powerups: Powerup[];
    playerStart: Point;
    environment: Environment;
}
