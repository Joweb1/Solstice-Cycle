
import { Player, Skin } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;
export const GRID_SIZE = 25;

// AVAILABLE SKINS
export const SKINS: Skin[] = [
    {
        id: 'default',
        name: 'Dawn Seeker',
        cost: 0,
        description: 'Standard issue environment suit optimized for dawn conditions.',
        colors: { body: '#4CAF50', helmet: '#2E7D32', visor: '#111', vest: '#388E3C' }
    },
    {
        id: 'midnight',
        name: 'Eclipse Operative',
        cost: 500,
        description: 'Pitch-black heat suppression armor designed for total eclipses.',
        colors: { body: '#263238', helmet: '#000000', visor: '#00E5FF', vest: '#37474F' }
    },
    {
        id: 'desert',
        name: 'Solar Flare',
        cost: 1200,
        description: 'Hyper-reflective mesh for high noon desert assignments.',
        colors: { body: '#D7CCC8', helmet: '#8D6E63', visor: '#3E2723', vest: '#A1887F' }
    },
    {
        id: 'crimson',
        name: 'Solstice Champion',
        cost: 2500,
        description: 'Elite crimson alloy optimized to absorb maximum sunset radiation.',
        colors: { body: '#B71C1C', helmet: '#7f0000', visor: '#FFD700', vest: '#D32F2F' }
    },
    {
        id: 'cyber',
        name: 'Zenith Core',
        cost: 5000,
        description: 'Experimental containment chassis powered by a direct sun mirror core.',
        colors: { body: '#E0E0E0', helmet: '#FFFFFF', visor: '#FF0055', vest: '#90A4AE' }
    }
];

// Base player stats 
export const INITIAL_PLAYER: Player = {
    x: 0, // Will be overridden by level gen
    y: 0,
    angle: -Math.PI / 2, 
    radius: 12, // Slightly larger for sprite visibility
    speed: 6,
    dead: false,
    currentPath: [],
    hp: 300,      // Significantly increased durability
    maxHp: 300,
    lastShotTime: 0,
    xp: 0,
    level: 1,
    nextLevelXp: 1000,
    knowledge: 0,
    credits: 0,
    unlockedSkins: ['default'],
    selectedSkin: 'default',
    shield: 0,
    activeEffects: {
        speed: 0,
        stealth: 0
    }
};

// Player Combat Stats
export const PLAYER_RANGE = 200;
export const PLAYER_FOV = 1.2; 
export const PLAYER_FIRE_RATE_MS = 150;
export const PLAYER_BULLET_DAMAGE = 30;

export const BULLET_SPEED = 7;
export const BULLET_DAMAGE = 8; // Slightly reduced from 10 to help player survive
export const FIRE_RATE_MS = 150; 
export const REACTION_TIME_MS = 200; 

// Hazards
export const BARREL_HP = 20;
export const BARREL_DAMAGE = 100;
export const BARREL_EXPLOSION_RADIUS = 120;
export const LASER_DAMAGE_PER_FRAME = 0.5; // ~30 DPS at 60fps

// Powerup Stats
export const POWERUP_MEDKIT_HEAL = 75;
export const POWERUP_SHIELD_AMOUNT = 50;
export const POWERUP_SPEED_DURATION = 5000; // 5s
export const POWERUP_SPEED_MULTIPLIER = 1.5;
export const POWERUP_STEALTH_DURATION = 6000; // 6s

// XP & Economy Values
export const XP_PER_KILL = 150;
export const CREDITS_PER_KILL = 50; // New currency
export const XP_PER_LEVEL_COMPLETE = 500;
export const CREDITS_PER_LEVEL_COMPLETE = 200;
