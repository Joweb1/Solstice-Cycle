import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_SIZE, BARREL_HP } from '../constants';
import { Wall, Enemy, Point, LevelConfig, WallType, EnemyType, Decoration, Laser, Environment, SolsticeModifier, SolsticePhase, Temperature, Powerup, PowerupType } from '../types';

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
    // Determine Solstice Modifier
    let solsticeModifier: SolsticeModifier = 'Golden Dawn';
    let solsticePhase: SolsticePhase = 'dawn';

    if (level === 1) {
        solsticeModifier = 'Golden Dawn';
        solsticePhase = 'dawn';
    } else if (level === 2) {
        solsticeModifier = 'High Noon';
        solsticePhase = 'noon';
    } else if (level === 3) {
        solsticeModifier = 'Crimson Sunset';
        solsticePhase = 'sunset';
    } else {
        const roll = Math.random();
        if (roll > 0.75) {
            solsticeModifier = 'Eclipse Event';
            solsticePhase = 'night';
        } else if (roll > 0.5) {
            solsticeModifier = 'Crimson Sunset';
            solsticePhase = 'sunset';
        } else if (roll > 0.25) {
            solsticeModifier = 'High Noon';
            solsticePhase = 'noon';
        } else {
            solsticeModifier = 'Golden Dawn';
            solsticePhase = 'dawn';
        }
    }

    // Determine Temperature
    let temperature: Temperature = 'normal';
    if (solsticeModifier === 'High Noon') {
        temperature = 'hot';
    } else if (solsticeModifier === 'Eclipse Event') {
        temperature = 'cold';
    } else {
        const tR = Math.random();
        if (tR > 0.7) temperature = 'hot';
        else if (tR > 0.4) temperature = 'cold';
    }

    // Set Colors based on Solstice Modifier
    let bgColor = '#18181a'; 
    let gridColor = '#242429';
    let overlayColor = 'transparent';

    switch (solsticeModifier) {
        case 'Golden Dawn':
            bgColor = '#1e140d'; // Warm ochre
            gridColor = '#2e1f14';
            overlayColor = 'rgba(230, 115, 0, 0.12)';
            break;
        case 'High Noon':
            bgColor = '#12181b'; // Blue slate sky
            gridColor = '#1d272d';
            overlayColor = 'rgba(255, 235, 59, 0.04)';
            break;
        case 'Crimson Sunset':
            bgColor = '#0f0814'; // Crimson dark violet
            gridColor = '#21132d';
            overlayColor = 'rgba(156, 39, 176, 0.2)';
            break;
        case 'Eclipse Event':
            bgColor = '#030305'; // Absolute pitch black
            gridColor = '#101015';
            overlayColor = 'rgba(13, 0, 32, 0.55)';
            break;
    }

    return {
        solsticePhase,
        solsticeModifier,
        temperature,
        bgColor,
        gridColor,
        overlayColor
    };
};

export const generateLevel = (levelNumber: number, difficultyMult: number): LevelConfig => {
    // Generate target environment
    const environment = generateEnvironment(levelNumber);
    const mod = environment.solsticeModifier;

    // Calculate density factor based on area
    const baseArea = 450 * 650;
    const currentArea = CANVAS_WIDTH * CANVAS_HEIGHT;
    const densityScale = Math.max(1, currentArea / baseArea);

    // Scaling threat budget, eclipse events feature higher threat and rewards
    let rawThreat = 50 + (levelNumber * 10) * difficultyMult;
    if (mod === 'Eclipse Event') rawThreat *= 1.25;
    const threatBudget = Math.floor(rawThreat * (densityScale * 0.8));
    
    // Support Budget (Powerups) - Reduced appearance as requested (only 45% chance to have powerups, max 1 or 2)
    const hasPowerups = Math.random() < 0.45;
    const supportBudget = hasPowerups ? Math.floor(rnd(1, 2)) : 0;

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
                         type = 'barrel'; // Will become "Solar Cores" visually
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

    // 2.2 Add Encrypted Alan Turing Terminals (unlocked in levels)
    const terminalCount = Math.min(3, rnd(1, 2) + (levelNumber % 2));
    for (let i = 0; i < terminalCount; i++) {
        let attempts = 0;
        let placed = false;
        while (attempts < 30 && !placed) {
            const w = GRID_SIZE;
            const h = GRID_SIZE;
            // Spawn around middle sectors
            const x = rnd(2, (CANVAS_WIDTH - 50)/GRID_SIZE) * GRID_SIZE;
            const y = rnd(3, (CANVAS_HEIGHT - 180)/GRID_SIZE) * GRID_SIZE;

            if (!checkOverlap(x, y, w, h, [...walls, safetyZone])) {
                walls.push({
                     id: wallIdCounter++,
                     x, y, w, h,
                     type: 'terminal',
                     hacked: false
                });
                placed = true;
            }
            attempts++;
        }
    }

    // 2.3 Add Trapped AI Subroutines (one per level)
    const aiCoreCount = levelNumber >= 2 ? 1 : 0;
    for (let i = 0; i < aiCoreCount; i++) {
        let attempts = 0;
        let placed = false;
        while (attempts < 30 && !placed) {
            const w = GRID_SIZE;
            const h = GRID_SIZE;
            const x = rnd(2, (CANVAS_WIDTH - 50)/GRID_SIZE) * GRID_SIZE;
            const y = rnd(3, (CANVAS_HEIGHT - 180)/GRID_SIZE) * GRID_SIZE;

            if (!checkOverlap(x, y, w, h, [...walls, safetyZone])) {
                walls.push({
                     id: wallIdCounter++,
                     x, y, w, h,
                     type: 'ai_core',
                     hacked: false
                });
                placed = true;
            }
            attempts++;
        }
    }

    // 3. Generate Powerups
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
                
                if (levelNumber > 2 && roll > 0.7) type = 'shield';
                else if (levelNumber > 3 && roll > 0.5) type = 'stealth';
                else if (roll > 0.3) type = 'speed';

                powerups.push({
                    id: i,
                    x: x + 12,
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

    // 5. Generate Enemies with Solstice Traits
    let currentThreat = 0;
    let enemyId = 0;
    let fails = 0;

    const costs = { soldier: 10, scout: 8, sniper: 15, heavy: 25 };

    while (currentThreat < threatBudget && fails < 20) {
        // Pick enemy type
        let type: EnemyType = 'soldier';
        const r = Math.random();
        
        // Under active Eclipse Event, heavy Eclipse Guardians (heavy) are much more common
        if (mod === 'Eclipse Event') {
            if (r > 0.6) type = 'heavy';
            else if (r > 0.4) type = 'sniper';
            else type = 'scout';
        } else {
            if (difficultyMult > 1.5 && r > 0.85) type = 'heavy';
            else if (difficultyMult > 1.2 && r > 0.7) type = 'sniper';
            else if (r > 0.4) type = 'scout';
        }

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
            const ey = rnd(50, CANVAS_HEIGHT - 200);

            if (checkOverlap(ex, ey, 30, 30, [...walls, safetyZone])) {
                attempts++;
                continue;
            }

            // Generate Patrol path
            const patrolPoints: Point[] = [];
            patrolPoints.push({x: ex, y: ey});
            const numPoints = rnd(2, 4);
            for(let p=0; p<numPoints; p++) {
                let px = ex + rnd(-150, 150);
                let py = ey + rnd(-150, 150);
                px = Math.max(50, Math.min(CANVAS_WIDTH-50, px));
                py = Math.max(50, Math.min(CANVAS_HEIGHT-50, py));
                if (!checkOverlap(px, py, 10, 10, walls)) {
                    patrolPoints.push({x: px, y: py});
                }
            }

            // Adapt Sensory stats based on the Solstice cycle
            // Base ranges: scout=180, soldier=220, sniper=350
            let baseRange = type === 'sniper' ? 350 : (type === 'scout' ? 180 : 220);
            let baseFov = type === 'sniper' ? 0.8 : 1.2;
            let baseSpeed = type === 'scout' ? 2.5 : (type === 'heavy' ? 1.0 : 1.8);

            if (mod === 'High Noon') {
                // Maximum solar brightness - wider and longer vision ranges
                baseRange *= 1.35;
                baseFov *= 1.15;
            } else if (mod === 'Golden Dawn') {
                // Low light, slow alert reaction speeds
                baseRange *= 0.9;
                baseSpeed *= 0.9;
            } else if (mod === 'Crimson Sunset') {
                // Creeping long shadows make concealment easy
                baseRange *= 0.8;
            } else if (mod === 'Eclipse Event') {
                // Pitch dark solar eclipse. Enemies are blind unless extremely close!
                baseRange *= 0.5; // Half sight range
                baseFov *= 0.8;
                baseSpeed *= 1.2; // Frantic quick patrols
            }

            enemies.push({
                id: enemyId++,
                x: ex, y: ey,
                angle: Math.random() * Math.PI * 2,
                range: baseRange,
                fov: baseFov,
                alive: true,
                patrolPoints,
                currentPatrolIdx: 0,
                actualPath: [],
                speed: baseSpeed,
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

    // Generate security laser gates starting from level 2
    if (levelNumber >= 2) {
        const numLasers = Math.floor(rnd(2, 4));
        for (let l = 0; l < numLasers; l++) {
            const isHorizontal = Math.random() > 0.5;
            if (isHorizontal) {
                const y = Math.floor(rnd(150, CANVAS_HEIGHT - 250));
                const w = Math.floor(rnd(100, 280));
                const x = Math.floor(rnd(30, CANVAS_WIDTH - w - 30));
                lasers.push({
                    x, y, w, h: 4,
                    active: true,
                    axis: 'x'
                });
            } else {
                const x = Math.floor(rnd(100, CANVAS_WIDTH - 100));
                const h = Math.floor(rnd(100, 240));
                const y = Math.floor(rnd(100, CANVAS_HEIGHT - h - 180));
                lasers.push({
                    x, y, w: 4, h,
                    active: true,
                    axis: 'y'
                });
            }
        }
    }

    return {
        walls,
        decorations,
        enemies,
        lasers,
        powerups,
        playerStart,
        environment
    };
};
