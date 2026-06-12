import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_SIZE, BARREL_HP } from '../constants';
import { Wall, Enemy, Point, LevelConfig, WallType, EnemyType, Decoration, Laser, Environment, TimeOfDay, Temperature, Powerup, PowerupType } from '../types';

// Helper to get random int
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to check overlap
const checkOverlap = (x: number, y: number, w: number, h: number, items: {x:number, y:number, w:number, h:number}[]) => {
    const buffer = 5; // Reduced buffer for tighter packing
    return items.some(item => 
        x < item.x + item.w + buffer &&
        x + w + buffer > item.x &&
        y < item.y + item.h + buffer &&
        y + h + buffer > item.y
    );
};

const generateEnvironment = (level: number): Environment => {
    // 1. Determine Time of Day
    const cyclePos = level % 4;
    let timeOfDay: TimeOfDay = 'day';
    
    // Weighted random for variety
    const r = Math.random();
    if (level === 1) timeOfDay = 'day';
    else if (r > 0.8) timeOfDay = 'night';
    else if (r > 0.6) timeOfDay = 'dusk';
    else if (r > 0.4) timeOfDay = 'dawn';
    else timeOfDay = 'day';

    // 2. Determine Temperature
    let temperature: Temperature = 'normal';
    const tR = Math.random();
    if (tR > 0.7) temperature = 'hot';
    else if (tR > 0.4) temperature = 'cold';

    // 3. Set Colors based on combinations
    let bgColor = '#202020'; // Default dark grey
    let gridColor = '#2a2a2a';
    let overlayColor = 'transparent';

    // Temp affects base colors
    if (temperature === 'hot') {
        bgColor = '#3e2723'; // Dark brown
        gridColor = '#4e342e';
    } else if (temperature === 'cold') {
        bgColor = '#263238'; // Blue grey
        gridColor = '#37474f';
    }

    // Time affects overlay
    switch (timeOfDay) {
        case 'night':
            overlayColor = 'rgba(0, 10, 30, 0.6)';
            break;
        case 'dusk':
            overlayColor = 'rgba(74, 35, 90, 0.3)';
            break;
        case 'dawn':
            overlayColor = 'rgba(211, 84, 0, 0.2)';
            break;
        case 'day':
        default:
            overlayColor = 'rgba(0, 0, 0, 0)'; 
            if (temperature === 'hot') overlayColor = 'rgba(255, 200, 0, 0.05)';
            break;
    }

    return {
        timeOfDay,
        temperature,
        bgColor,
        gridColor,
        overlayColor
    };
};

export const generateLevel = (levelNumber: number, difficultyMult: number): LevelConfig => {
    // Calculate density factor based on area
    const baseArea = 450 * 650;
    const currentArea = CANVAS_WIDTH * CANVAS_HEIGHT;
    const densityScale = Math.max(1, currentArea / baseArea);

    const threatBudget = Math.floor((50 + (levelNumber * 10) * difficultyMult) * (densityScale * 0.8)); // Threat
    
    // Support Budget (Powerups)
    // Base amount + random chance
    const supportBudget = Math.floor(rnd(1, 3) + (levelNumber * 0.1));

    // Scale object counts by density
    const obstacleCount = Math.floor(rnd(15, 25) * densityScale);
    
    const walls: Wall[] = [];
    const decorations: Decoration[] = [];
    const enemies: Enemy[] = [];
    const lasers: Laser[] = [];
    const powerups: Powerup[] = [];
    const playerStart: Point = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100 };
    
    const safetyZone = { x: playerStart.x - 100, y: playerStart.y - 100, w: 200, h: 200 };

    let wallIdCounter = 0;

    // 1. Generate Structural Walls & Large Obstacles
    for (let i = 0; i < obstacleCount; i++) {
        let attempts = 0;
        let placed = false;
        while (attempts < 50 && !placed) {
            // Snap to grid
            const w = rnd(2, 5) * GRID_SIZE;
            const h = rnd(2, 5) * GRID_SIZE;
            const x = rnd(1, (CANVAS_WIDTH - w)/GRID_SIZE) * GRID_SIZE;
            const y = rnd(2, (CANVAS_HEIGHT - h - 100)/GRID_SIZE) * GRID_SIZE;

            const typeRoll = Math.random();
            let type: WallType = 'crate';
            if (typeRoll > 0.85) type = 'container';
            else if (typeRoll > 0.6) type = 'wall';
            else if (typeRoll > 0.4) type = 'pillar';

            // Check collision with player safety zone and existing walls
            if (!checkOverlap(x, y, w, h, [...walls, safetyZone])) {
                walls.push({ id: wallIdCounter++, x, y, w, h, type });
                placed = true;
            }
            attempts++;
        }
    }

    // 2. Add Clutter (Drums, Barrels, Treasure)
    const clutterCount = Math.floor(rnd(10, 20) * densityScale);
    for(let i=0; i<clutterCount; i++) {
        let attempts = 0;
        let placed = false;
        
        while(attempts < 20 && !placed) {
            const isSmall = Math.random() > 0.3;
            const w = isSmall ? GRID_SIZE : GRID_SIZE * 2; 
            const h = isSmall ? GRID_SIZE : GRID_SIZE * 2;
            
            // Try to spawn near an existing wall
            const targetWall = walls[rnd(0, walls.length-1)];
            let x = 0, y = 0;
            
            if (targetWall) {
                const side = rnd(0, 3); // 0: top, 1: right, 2: bottom, 3: left
                if (side === 0) { x = targetWall.x + rnd(0, targetWall.w - w); y = targetWall.y - h; }
                else if (side === 1) { x = targetWall.x + targetWall.w; y = targetWall.y + rnd(0, targetWall.h - h); }
                else if (side === 2) { x = targetWall.x + rnd(0, targetWall.w - w); y = targetWall.y + targetWall.h; }
                else { x = targetWall.x - w; y = targetWall.y + rnd(0, targetWall.h - h); }
            } else {
                x = rnd(1, (CANVAS_WIDTH - w)/GRID_SIZE) * GRID_SIZE;
                y = rnd(2, (CANVAS_HEIGHT - h - 100)/GRID_SIZE) * GRID_SIZE;
            }

            // Keep within bounds
            if (x > 0 && x < CANVAS_WIDTH - w && y > 0 && y < CANVAS_HEIGHT - 50) {
                if (!checkOverlap(x, y, w, h, [...walls, safetyZone])) {
                    let type: WallType = 'crate';
                    const roll = Math.random();
                    let hp = undefined;
                    
                    if (roll > 0.9) type = 'treasure';
                    else if (roll > 0.7) { 
                        type = 'barrel'; 
                        hp = BARREL_HP; 
                    }
                    else if (roll > 0.5) type = 'drum';
                    else type = 'crate';

                    walls.push({ id: wallIdCounter++, x, y, w, h, type, hp, maxHp: hp });
                    placed = true;
                }
            }
            attempts++;
        }
    }

    // 3. Generate Powerups
    // Prioritize open areas
    for (let i = 0; i < supportBudget; i++) {
        let attempts = 0;
        let placed = false;
        while (attempts < 20 && !placed) {
            const w = 20; const h = 20;
            const x = rnd(2, (CANVAS_WIDTH - 50)/GRID_SIZE) * GRID_SIZE;
            const y = rnd(2, (CANVAS_HEIGHT - 100)/GRID_SIZE) * GRID_SIZE;
            
            if (!checkOverlap(x, y, w, h, [...walls, safetyZone])) {
                const roll = Math.random();
                let type: PowerupType = 'medkit';
                
                // Better powerups on higher levels or small chance
                if (levelNumber > 2 && roll > 0.7) type = 'shield';
                else if (levelNumber > 3 && roll > 0.5) type = 'stealth';
                else if (roll > 0.3) type = 'speed';

                powerups.push({
                    id: i,
                    x: x + 12, // Center in tile roughly
                    y: y + 12,
                    type,
                    active: true,
                    bobOffset: Math.random() * Math.PI * 2
                });
                placed = true;
            }
            attempts++;
        }
    }

    // 4. Generate Decorations
    const decoCount = Math.floor(rnd(20, 40) * densityScale);
    for(let i=0; i<decoCount; i++) {
        const x = rnd(0, CANVAS_WIDTH);
        const y = rnd(0, CANVAS_HEIGHT);
        const roll = Math.random();
        let type: Decoration['type'] = 'litter';
        if (roll > 0.8) type = 'rubble';
        else if (roll > 0.5) type = 'crack';
        else if (roll > 0.3) type = 'stain';
        
        decorations.push({
            x, y, type,
            rotation: Math.random() * Math.PI * 2,
            scale: 0.5 + Math.random(),
            color: 'rgba(0,0,0,0.3)'
        });
    }

    // 5. Generate Enemies
    let currentThreat = 0;
    let enemyId = 0;
    let fails = 0;

    const costs = { soldier: 10, scout: 8, sniper: 15, heavy: 25 };

    while (currentThreat < threatBudget && fails < 20) {
        // Pick enemy type
        let type: EnemyType = 'soldier';
        const r = Math.random();
        if (difficultyMult > 1.5 && r > 0.85) type = 'heavy';
        else if (difficultyMult > 1.2 && r > 0.7) type = 'sniper';
        else if (r > 0.4) type = 'scout';

        const cost = costs[type];
        if (currentThreat + cost > threatBudget) {
            fails++;
            continue;
        }

        // Place enemy
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 10) {
            const ex = rnd(50, CANVAS_WIDTH - 50);
            const ey = rnd(50, CANVAS_HEIGHT - 200); // Keep away from immediate bottom spawn

            if (checkOverlap(ex, ey, 30, 30, [...walls, safetyZone])) {
                attempts++;
                continue;
            }

            // Generate Patrol
            const patrolPoints: Point[] = [];
            patrolPoints.push({x: ex, y: ey});
            const numPoints = rnd(2, 4);
            for(let p=0; p<numPoints; p++) {
                let px = ex + rnd(-150, 150);
                let py = ey + rnd(-150, 150);
                // Simple bounds check
                px = Math.max(50, Math.min(CANVAS_WIDTH-50, px));
                py = Math.max(50, Math.min(CANVAS_HEIGHT-50, py));
                if (!checkOverlap(px, py, 10, 10, walls)) {
                    patrolPoints.push({x: px, y: py});
                }
            }

            enemies.push({
                id: enemyId++,
                x: ex, y: ey,
                angle: Math.random() * Math.PI * 2,
                range: type === 'sniper' ? 350 : (type === 'scout' ? 180 : 220),
                fov: type === 'sniper' ? 0.8 : 1.2,
                alive: true,
                patrolPoints,
                currentPatrolIdx: 0,
                actualPath: [],
                speed: type === 'scout' ? 2.5 : (type === 'heavy' ? 1.0 : 1.8),
                waitTime: 0,
                state: 'init',
                lastShotTime: 0,
                type,
                hp: type === 'heavy' ? 80 : (type === 'soldier' ? 40 : 25),
                maxHp: type === 'heavy' ? 80 : (type === 'soldier' ? 40 : 25),
                enraged: false,
                lastPathCalcTime: 0
            });
            currentThreat += cost;
            placed = true;
        }
        if(!placed) fails++;
    }

    return {
        walls,
        decorations,
        enemies,
        lasers,
        powerups,
        playerStart,
        environment: generateEnvironment(levelNumber)
    };
};