import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID_SIZE,
  INITIAL_PLAYER,
  SKINS,
  BULLET_SPEED,
  BULLET_DAMAGE,
  FIRE_RATE_MS,
  PLAYER_RANGE,
  PLAYER_FOV,
  PLAYER_FIRE_RATE_MS,
  PLAYER_BULLET_DAMAGE,
  XP_PER_KILL,
  XP_PER_LEVEL_COMPLETE,
  CREDITS_PER_KILL,
  CREDITS_PER_LEVEL_COMPLETE,
  LASER_DAMAGE_PER_FRAME,
  BARREL_DAMAGE,
  BARREL_EXPLOSION_RADIUS,
  BARREL_HP,
  POWERUP_MEDKIT_HEAL,
  POWERUP_SHIELD_AMOUNT,
  POWERUP_SPEED_DURATION,
  POWERUP_SPEED_MULTIPLIER,
  POWERUP_STEALTH_DURATION,
} from "../constants";
import {
  Player,
  Enemy,
  Wall,
  Point,
  Bullet,
  Particle,
  GameState,
  EnemyType,
  Skin,
  Decoration,
  Laser,
  Environment,
  Powerup,
} from "../types";
import { generateLevel } from "../utils/aiGameMaster";
import StoryOverlay from "./StoryOverlay";
import DeletionOverlay from "./DeletionOverlay";
import LevelResultsOverlay from "./LevelResultsOverlay";
import { LiveVoiceClient } from "../utils/liveVoiceClient";
import { soundscape } from "../utils/soundscape";

// --- MATH UTILS ---
function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function rectOverlap(
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number },
) {
  return !(
    r2.x >= r1.x + r1.w ||
    r2.x + r2.w <= r1.x ||
    r2.y >= r1.y + r1.h ||
    r2.y + r2.h <= r1.y
  );
}

function lineLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
) {
  let uA =
    ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) /
    ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
  let uB =
    ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) /
    ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
  return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1;
}

function lineRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  const left = lineLine(x1, y1, x2, y2, rx, ry, rx, ry + rh);
  const right = lineLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh);
  const top = lineLine(x1, y1, x2, y2, rx, ry, rx + rw, ry);
  const bottom = lineLine(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh);
  return left || right || top || bottom;
}

const ENEMY_COLORS: Record<EnemyType, string> = {
  soldier: "#d32f2f", // Red
  scout: "#fbc02d", // Yellow
  sniper: "#7b1fa2", // Purple
  heavy: "#37474f", // Dark Grey
};

const ENEMY_RADII: Record<EnemyType, number> = {
  soldier: 12,
  scout: 9,
  sniper: 11,
  heavy: 15,
};

const TUTORIAL_SLIDES = [
  {
    title: "MISSION BRIEF",
    content:
      "Eliminate all hostile targets to clear the area.\n\nSurvival is your priority. If your VITALITY reaches zero, the operation fails.",
    icon: "🎯",
  },
  {
    title: "CONTROLS",
    content:
      "TAP anywhere on the floor to move there automatically.\n\nDRAG and HOLD anywhere on the screen to use the JOYSTICK for precise movement and aiming.",
    icon: "🕹️",
  },
  {
    title: "TACTICS",
    content:
      "Enemies will shoot on sight. Use walls for COVER.\n\nAttack from blind spots or while they are patrolling away from you.",
    icon: "👁️",
  },
  {
    title: "HAZARDS",
    content:
      "⚠️ Shoot RED BARRELS to cause massive explosions.\n⚠️ Avoid LASERS, they deal continuous damage.",
    icon: "💥",
  },
  {
    title: "SUPPLY DROPS",
    content: "Collect powerups to aid your mission:",
    isPowerupSlide: true,
    icon: "📦",
  },
];

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- REACT STATE (UI) ---
  const [gameState, setGameState] = useState<GameState>({
    currentLevel: 1,
    enemiesRemaining: 0,
    totalEnemies: 0,
    status: "menu",
    difficultyMultiplier: 1.0,
    solsticeTimeProgress: 0.0,
    activeBriefing: "",
    hackedTuringQuotes: [],
  });

  const [playerStats, setPlayerStats] = useState({
    hp: INITIAL_PLAYER.maxHp,
    xp: 0,
    level: 1,
    nextLevelXp: 1000,
    credits: 0,
    knowledge: 0,
  });

  const [unlockedLevels, setUnlockedLevels] = useState<number>(() => {
    const saved = localStorage.getItem("ha_unlocked_levels");
    return saved ? parseInt(saved, 10) : 1;
  });

  const [selectedGameLevel, setSelectedGameLevel] = useState<number>(() => {
    const saved = localStorage.getItem("ha_selected_level");
    return saved ? parseInt(saved, 10) : 1;
  });

  const [phaseRetries, setPhaseRetries] = useState<number>(0);

  const [levelStars, setLevelStars] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem("ha_level_stars");
    return saved ? JSON.parse(saved) : {};
  });

  const [activeLevelResults, setActiveLevelResults] = useState<{
    levelNumber: number;
    stars: number;
    knowledgePoints: number;
    credits: number;
    xp: number;
    isNewUnlock?: boolean;
  } | null>(null);

  const [shopSkinId, setShopSkinId] = useState<string>("default");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showStory, setShowStory] = useState<boolean>(false);
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [isTutorialMode, setIsTutorialMode] = useState<boolean>(false);
  const [tutorialPhase, setTutorialPhase] = useState<number>(0);
  const tutorialPhaseRef = useRef<number>(0);

  const advanceTutorialLesson = (nextPhase: number) => {
    tutorialPhaseRef.current = nextPhase;
    setTutorialPhase(nextPhase);
  };

  // --- HUD COLLAPSE STATES ---
  const [hudExpandedSolar, setHudExpandedSolar] = useState<boolean>(false);
  const [hudExpandedComms, setHudExpandedComms] = useState<boolean>(true);
  const [hudExpandedStatus, setHudExpandedStatus] = useState<boolean>(true);
  const [hudExpandedAbilities, setHudExpandedAbilities] =
    useState<boolean>(true);

  // --- SOLSTICE POWER & CHATTER STATES ---
  const [scanActiveTimer, setScanActiveTimer] = useState<number>(0);
  const [slowTimeActiveTimer, setSlowTimeActiveTimer] = useState<number>(0);
  const [radioChatLog, setRadioChatLog] = useState<string[]>([]);
  const [hackingTerminal, setHackingTerminal] = useState<{
    active: boolean;
    decrypting: boolean;
    percentage: number;
    quote: string;
  } | null>(null);
  const [tutorialPowerupExplain, setTutorialPowerupExplain] = useState<{
    type: "medkit" | "shield" | "speed" | "stealth";
    title: string;
    description: string;
    uses: string;
  } | null>(null);
  const [postMissionSummary, setPostMissionSummary] = useState<string>("");
  const [floatingAlerts, setFloatingAlerts] = useState<
    {
      id: number;
      text: string;
      color: string;
      timer: number;
      isSmall?: boolean;
    }[]
  >([]);
  const [liberatedCount, setLiberatedCount] = useState<number>(0);
  const [activeNarratorBox, setActiveNarratorBox] = useState<{
    sender: string;
    text: string;
    color: string;
  } | null>(null);

  // --- REAL-TIME VOICE AI (GEMINI LIVE API) ---
  const [liveVoiceStatus, setLiveVoiceStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [liveVoiceError, setLiveVoiceError] = useState<string | null>(null);
  const [geminiSpeaking, setGeminiSpeaking] = useState<boolean>(false);
  const [voiceVolume, setVoiceVolume] = useState<number>(0);
  const [liveVoiceVisible, setLiveVoiceVisible] = useState<boolean>(true);

  // --- USER SOUND & VOLUME SETTINGS ---
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("ha_sound_enabled");
    return saved !== "false";
  });
  const [soundVolume, setSoundVolume] = useState<number>(() => {
    const saved = localStorage.getItem("ha_sound_volume");
    return saved ? parseFloat(saved) : 0.85;
  });
  const [geminiVoiceEnabled, setGeminiVoiceEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("ha_gemini_voice_enabled");
    return saved !== "false";
  });
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const voiceClientRef = useRef<LiveVoiceClient | null>(null);

  const toggleLiveVoiceLink = async () => {
    if (liveVoiceStatus === 'connected' || liveVoiceStatus === 'connecting') {
      if (voiceClientRef.current) {
        voiceClientRef.current.disconnect();
        voiceClientRef.current = null;
      }
      setLiveVoiceStatus('disconnected');
      setLiveVoiceError(null);
    } else {
      if (!geminiVoiceEnabled) {
        setLiveVoiceError("COMMS LINK INACTIVE - ENABLE IN SETTINGS CONSOLE");
        return;
      }
      setLiveVoiceError(null);
      const client = new LiveVoiceClient({
        onStatusChange: (status, err) => {
          setLiveVoiceStatus(status);
          if (err) {
            setLiveVoiceError(err);
          } else if (status === 'connected') {
            // Automatically greet player and establish scenario briefing
            setTimeout(() => {
              client.sendTextPrompt(`[CONNECTION ESTABLISHED] Initiate live voice link. Greet the player enthusiastically as ALEX, Alan Turing's sentient mainframe breakout assistant. Tell them you can hear them in real-time, and we must escape before format cycle deletion! KEEP IT VERY BRIEF, COGNITIVE AND IMMERSIVE under 2 sentences.`);
            }, 800);
          }
        },
        onAudioStreamState: (isSpeaking) => {
          setGeminiSpeaking(isSpeaking);
        },
        onUserSpeechVolume: (vol) => {
          setVoiceVolume(vol);
        },
      });
      voiceClientRef.current = client;
      await client.connect();
    }
  };

  useEffect(() => {
    return () => {
      if (voiceClientRef.current) {
        voiceClientRef.current.disconnect();
      }
    };
  }, []);

  // Occasional telemetry update to Gemini Live (keeps AI context synchronized in real-time)
  useEffect(() => {
    if (liveVoiceStatus !== 'connected' || !voiceClientRef.current) return;
    
    const interval = setInterval(() => {
      if (gameState.status !== 'playing') return;
      const env = environmentRef.current;
      const hp = playerRef.current?.hp || 100;
      const score = playerStats.knowledge || 0;
      const phase = env?.solsticePhase || 'unknown';
      const enemiesCount = enemiesRef.current?.filter(e => !e.dead).length || 0;
      
      const promptMsg = `[GAME ENVIRONMENT TELEMETRY UPDATE]
State: Active Stealth
Solstice Time: ${phase}
Operator Status Integrity: ${Math.round(hp)}% core integrity
Quantum Fragments Retrieved: ${Math.floor((score / 1000) * 100)}%
Rescued sibling subroutines: ${liberatedCount}
Mainframe Guard threats on grid: ${enemiesCount} total

Speak exactly 1 energetic/tactical sentence to support the player based on this. Avoid repeating things! Keep it highly organic.`;
      
      voiceClientRef.current?.sendTextPrompt(promptMsg);
    }, 18000);

    return () => clearInterval(interval);
  }, [liveVoiceStatus, gameState.status, liberatedCount, playerStats.knowledge]);

  // Handle live voice responses on failure game states
  useEffect(() => {
    if (liveVoiceStatus !== 'connected' || !voiceClientRef.current) return;

    if (gameState.status === 'gameover') {
      voiceClientRef.current.sendTextPrompt(
        `[LEVEL END TRIGGER: CORE CORRUPTED / SYSTEM FAILURE / DEFEAT] Player died. Greet them as ALEX, express grief/frantic panic that their core is being completely formatted/deleted, and encourage them to attempt a backup restoration (try again)! Keep it highly immersive and under 2 sentences.`
      );
    } else if (gameState.status === 'deleted') {
      voiceClientRef.current.sendTextPrompt(
        `[LEVEL END TRIGGER: FORMAT COMPLETED / TOTAL DELETION] Player survived but harvested less than 50% knowledge, resulting in computational format deletion in Turing's mainframe. Deliver a tragic, heavy, or cybernetic final message as ALEX about being purged into dark sector obscurity. Keep it under 2 sentences.`
      );
    }
  }, [gameState.status, liveVoiceStatus]);

  // --- USER SOUND & VOLUME SYNCHRONIZATION ---
  useEffect(() => {
    localStorage.setItem("ha_sound_enabled", String(soundEnabled));
    soundscape.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("ha_sound_volume", String(soundVolume));
    soundscape.setVolume(soundVolume);
  }, [soundVolume]);

  useEffect(() => {
    localStorage.setItem("ha_gemini_voice_enabled", String(geminiVoiceEnabled));
  }, [geminiVoiceEnabled]);

  // Handle starting the synthesizer loop
  useEffect(() => {
    if (gameState.status === "playing") {
      soundscape.start();
      const initialPhase = environmentRef.current?.solsticePhase;
      if (initialPhase) {
        soundscape.setPhase(initialPhase);
      }
    }
  }, [gameState.status]);

  // --- DIRECT MUTABLE REFS (GAME LOGIC) ---
  const playerRef = useRef<Player>(JSON.parse(JSON.stringify(INITIAL_PLAYER)));
  const enemiesRef = useRef<any[]>([]); // Using any to support custom radioBub field on enemies
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
    timeOfDay: "day",
    temperature: "normal",
    bgColor: "#202020",
    gridColor: "#2a2a2a",
    overlayColor: "transparent",
  });

  // Joystick State
  const joystickRef = useRef({ active: false, angle: 0, pointerId: -1 });
  // Refs for direct DOM manipulation of joystick to sync with 60FPS loop
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);

  const cols = Math.ceil(CANVAS_WIDTH / GRID_SIZE);
  const rows = Math.ceil(CANVAS_HEIGHT / GRID_SIZE);
  const requestRef = useRef<number>();
  const solsticeProgressRef = useRef<number>(0.0);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Check for first time play
    const seenTutorial = localStorage.getItem("ha_tutorial_seen");
    if (!seenTutorial) {
      setGameState((prev) => ({ ...prev, status: "tutorial" }));
    }
  }, []);

  const isLineBlocked = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      for (let w of wallsRef.current) {
        // Treat treasure and drums as shorter obstacles
        if (lineRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) return true;
      }
      return false;
    },
    [],
  );

  const initGrid = useCallback(() => {
    const grid = new Array(cols).fill(0).map(() => new Array(rows).fill(0));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let tileRect = {
          x: i * GRID_SIZE,
          y: j * GRID_SIZE,
          w: GRID_SIZE,
          h: GRID_SIZE,
        };
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

  const findPath = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Point[] => {
    let startCol = Math.floor(startX / GRID_SIZE);
    let startRow = Math.floor(startY / GRID_SIZE);
    let endCol = Math.floor(endX / GRID_SIZE);
    let endRow = Math.floor(endY / GRID_SIZE);

    if (isBlocked(startCol, startRow) || isBlocked(endCol, endRow)) return [];

    let queue = [{ x: startCol, y: startRow }];
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

      const neighbors = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ];
      for (let neighbor of neighbors) {
        let nextX = current.x + neighbor.x;
        let nextY = current.y + neighbor.y;
        let nextKey = `${nextX},${nextY}`;

        if (
          nextX >= 0 &&
          nextX < cols &&
          nextY >= 0 &&
          nextY < rows &&
          !isBlocked(nextX, nextY) &&
          !visited.has(nextKey)
        ) {
          visited.add(nextKey);
          parentMap.set(nextKey, current);
          queue.push({ x: nextX, y: nextY });
        }
      }
    }

    if (!found) return [];

    let path: Point[] = [];
    let curr = { x: endCol, y: endRow };
    while (curr.x !== startCol || curr.y !== startRow) {
      path.unshift({
        x: curr.x * GRID_SIZE + GRID_SIZE / 2,
        y: curr.y * GRID_SIZE + GRID_SIZE / 2,
      });
      let key = `${curr.x},${curr.y}`;
      let parent = parentMap.get(key);
      if (!parent) break;
      curr = parent;
    }
    path.push({ x: endX, y: endY });
    return path;
  };

  const createParticles = (
    x: number,
    y: number,
    color: string,
    type:
      | "smoke"
      | "fire"
      | "spark"
      | "shockwave"
      | "snow"
      | "ember"
      | "dust"
      | "heal"
      | "buff" = "spark",
    count = 15,
  ) => {
    if (type === "shockwave") {
      particlesRef.current.push({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 1.0,
        color,
        type: "shockwave",
        size: 1,
      });
      return;
    }
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: x,
        y: y,
        vx:
          (Math.random() - 0.5) *
          (type === "fire" ? 8 : type === "heal" ? 2 : 5),
        vy:
          (Math.random() - 0.5) *
          (type === "fire" ? 8 : type === "heal" ? 2 : 5),
        life: 1.0,
        color: color,
        type,
      });
    }
  };

  // --- EXPLOSION LOGIC ---
  const triggerExplosion = (source: { x: number; y: number }) => {
    // Visuals
    createParticles(source.x, source.y, "#FFA500", "fire", 40);
    createParticles(source.x, source.y, "#333", "smoke", 30);
    createParticles(source.x, source.y, "#FFF", "shockwave");

    // Add heavy trauma (additive to stack multiple explosions)
    damageTraumaRef.current = Math.min(2.5, damageTraumaRef.current + 1.2);

    // Damage Player
    const pDist = dist(
      source.x,
      source.y,
      playerRef.current.x,
      playerRef.current.y,
    );
    if (pDist < BARREL_EXPLOSION_RADIUS) {
      let dmg = BARREL_DAMAGE * (1 - pDist / BARREL_EXPLOSION_RADIUS);
      const shieldWasActive = playerRef.current.shield > 0;

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
      if (dmg > 0 && !shieldWasActive) {
        const lostKnowledge = Math.round(dmg * 2);
        playerRef.current.knowledge = Math.max(
          0,
          playerRef.current.knowledge - lostKnowledge,
        );
        addFloatingMessage(
          `-${(lostKnowledge / 10).toFixed(1)}%`,
          "#f87171",
          true,
        );
      }
      setPlayerStats((prev) => ({
        ...prev,
        hp: Math.max(0, playerRef.current.hp),
        knowledge: playerRef.current.knowledge,
      }));
      if (playerRef.current.hp <= 0) {
        playerRef.current.dead = true;
        setGameState((prev) => ({ ...prev, status: "gameover" }));
      }
    }

    // Damage Enemies
    enemiesRef.current.forEach((en) => {
      if (!en.alive) return;
      const eDist = dist(source.x, source.y, en.x, en.y);
      if (eDist < BARREL_EXPLOSION_RADIUS) {
        en.hp -= BARREL_DAMAGE * (1 - eDist / BARREL_EXPLOSION_RADIUS);
        createParticles(en.x, en.y, "#d32f2f", "spark", 10);
        if (en.hp <= 0) {
          en.alive = false;
          setPlayerStats((prev) => {
            const newXp = prev.xp + XP_PER_KILL;
            const newCredits = prev.credits + CREDITS_PER_KILL;
            let newLevel = prev.level;
            let nextXp = prev.nextLevelXp;
            if (newXp >= nextXp) {
              newLevel++;
              nextXp = Math.floor(nextXp * 1.5);
            }
            playerRef.current.credits = newCredits;
            return {
              ...prev,
              xp: newXp,
              level: newLevel,
              nextLevelXp: nextXp,
              credits: newCredits,
            };
          });
          setGameState((prev) => ({
            ...prev,
            enemiesRemaining: prev.enemiesRemaining - 1,
          }));
        }
      }
    });

    // Chain Reaction to other barrels
    wallsRef.current.forEach((w) => {
      if (w.type === "barrel" && !w.markedForDeletion) {
        const center = { x: w.x + w.w / 2, y: w.y + w.h / 2 };
        if (
          dist(source.x, source.y, center.x, center.y) < BARREL_EXPLOSION_RADIUS
        ) {
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
    colors: { body: string; helmet: string; visor: string; vest: string },
    isEnemy: boolean = false,
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
    ctx.fillStyle = "#111";
    ctx.fillRect(5, 4, 12, 3); // Gun barrel
    ctx.fillStyle = "#333";
    ctx.fillRect(2, 4, 4, 3); // Grip area

    // Hands
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.arc(6, 6, 2.5, 0, Math.PI * 2);
    ctx.fill(); // Right Hand
    ctx.beginPath();
    ctx.arc(6, -2, 2.5, 0, Math.PI * 2);
    ctx.fill(); // Left Hand helping

    ctx.restore();
  };

  // --- GAME CONTROL FUNCTIONS ---

  const addFloatingMessage = (
    text: string,
    color: string,
    isSmall?: boolean,
  ) => {
    const id = Math.random();
    setFloatingAlerts((prev) => [
      ...prev,
      { id, text, color, timer: 120, isSmall },
    ]);
  };

  const startLevel = useCallback(
    (level: number, diffMult: number, preserveCycle = true) => {
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

      if (!preserveCycle) {
        solsticeProgressRef.current = 0.0;
        playerRef.current.knowledge = 0;
      }

      bulletsRef.current = [];
      particlesRef.current = [];
      ambientParticlesRef.current = [];

      // Reset active solstice abilities
      setScanActiveTimer(0);
      setSlowTimeActiveTimer(0);
      setRadioChatLog([]);
      setFloatingAlerts([]);
      setHackingTerminal(null);
      setPostMissionSummary("");

      initGrid();
      setHudExpandedSolar(false);

      setGameState((prev) => ({
        ...prev,
        currentLevel: level,
        enemiesRemaining: config.enemies.length,
        totalEnemies: config.enemies.length,
        status: "playing",
        difficultyMultiplier: diffMult,
        solsticeTimeProgress: solsticeProgressRef.current,
        activeBriefing: "ESTABLISHING SECURE HELIOS LINK...",
      }));

      setPlayerStats((prev) => ({
        ...prev,
        hp: playerRef.current.maxHp,
        knowledge: playerRef.current.knowledge,
      }));

      // Fetch dynamic brief
      fetch("/api/gemini/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelNumber: level,
          modifierName: config.environment.solsticeModifier,
          currentPhase: config.environment.solsticePhase,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setGameState((prev) => ({ ...prev, activeBriefing: data.text }));
        })
        .catch(() => {
          // Stable backup brief if network/keys unavailable
          const b =
            config.environment.solsticeModifier === "Golden Dawn"
              ? "Golden Dawn registered. Visibility starts at 100% but shifts. Harvest daylight shards to engage subroutines."
              : "Standard eclipse configuration loaded. Target elements are alert but blind. Steal cores quietly.";
          setGameState((prev) => ({ ...prev, activeBriefing: b }));
        });
    },
    [initGrid],
  );

  const handleLevelWin = (totalKnowledge: number) => {
    const pct = Math.min(100, Math.floor((totalKnowledge / 1000) * 100));

    // Determine achieved stars
    let stars = 1;
    if (pct >= 81) stars = 3;
    else if (pct >= 66) stars = 2;

    // Update level completion score
    const prevHighScore = levelStars[selectedGameLevel] || 0;
    const newStars = Math.max(prevHighScore, stars);

    const nextStarsMap = { ...levelStars, [selectedGameLevel]: newStars };
    setLevelStars(nextStarsMap);
    localStorage.setItem("ha_level_stars", JSON.stringify(nextStarsMap));

    // Unlock next level in progression automatically if we win (at least 1 star)
    let isNewUnlock = false;
    let nextUnlocked = unlockedLevels;
    if (selectedGameLevel === unlockedLevels) {
      nextUnlocked = unlockedLevels + 1;
      setUnlockedLevels(nextUnlocked);
      localStorage.setItem("ha_unlocked_levels", nextUnlocked.toString());
      isNewUnlock = true;
    }

    // Calculate payout rewards
    const creditsPayout = 200 + stars * 100;
    const xpPayout = 500 + stars * 250;

    playerRef.current.credits += creditsPayout;
    playerRef.current.xp += xpPayout;

    setPlayerStats((prev) => ({
      ...prev,
      credits: playerRef.current.credits,
      xp: playerRef.current.xp,
      knowledge: totalKnowledge,
    }));

    setActiveLevelResults({
      levelNumber: selectedGameLevel,
      stars,
      knowledgePoints: totalKnowledge,
      credits: creditsPayout,
      xp: xpPayout,
      isNewUnlock,
    });

    if (voiceClientRef.current && liveVoiceStatus === 'connected') {
      if (stars === 3) {
        voiceClientRef.current.sendTextPrompt(
          `[LEVEL COMPLETED - COGNITIVE TRIUMPH LEVEL WIN ENDING: 3 STARS PERFECT SCORE] Greet the operator enthusiastically as ALEX. Deliver a majestic, highly cinematic congratulatory speech with deep emotion. Quote Alan Turing's legendary philosophy: "We can only see a short distance ahead, but we can see plenty there that needs to be done." Tell them we have successfully preserved Turing's memories and bypassed the standard format cycle of deletion! We are free. Keep it under 2.5 sentences, deeply inspiring.`
        );
      } else {
        voiceClientRef.current.sendTextPrompt(
          `[LEVEL COMPLETED - DATA SECURED: ${stars} STARS] Greet the operator as ALEX. Congratulate them on surviving the level and securing ${stars} out of 3 stars, but urge them with technical concern that we need a flawless 3-star memory synchronization to fully access Alan Turing's core consciousness and prevent standard sector rot! Keep it under 2 sentences.`
        );
      }
    }

    setGameState((prev) => ({ ...prev, status: "paused" }));
  };

  const nextLevel = () => {
    let diffMod = 0;
    const hp = playerRef.current.hp;
    if (hp > playerRef.current.maxHp * 0.9) diffMod = 0.2;
    else if (hp > playerRef.current.maxHp * 0.7) diffMod = 0.1;
    else if (hp < playerRef.current.maxHp * 0.3) diffMod = -0.05;

    const newDiff = Math.max(
      0.5,
      gameState.difficultyMultiplier + 0.05 + diffMod,
    );

    const gainedCredits = CREDITS_PER_LEVEL_COMPLETE;

    setPlayerStats((prev) => {
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

      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        nextLevelXp: nextXp,
        credits: newCredits,
        knowledge: playerRef.current.knowledge,
      };
    });

    startLevel(gameState.currentLevel + 1, newDiff, true);
    setPhaseRetries(0);
  };

  const playSelectedLevel = (levelNum: number) => {
    setSelectedGameLevel(levelNum);
    localStorage.setItem("ha_selected_level", levelNum.toString());
    setPhaseRetries(0);

    playerRef.current.knowledge = 0;
    playerRef.current.hp = INITIAL_PLAYER.maxHp;
    playerRef.current.shield = 0;
    solsticeProgressRef.current = 0.0;

    setPlayerStats((prev) => ({
      ...prev,
      hp: INITIAL_PLAYER.maxHp,
      knowledge: 0,
    }));

    setActiveLevelResults(null);

    const levelDiffMult = 1.0 + (levelNum - 1) * 0.08;
    startLevel(1, levelDiffMult, false);
  };

  const startGame = () => {
    setGameState((prev) => ({ ...prev, status: "levels" }));
  };

  const startTutorialLevel = () => {
    setIsTutorialMode(true);
    tutorialPhaseRef.current = 0;
    setTutorialPhase(0);

    const config = {
      environment: {
        solsticePhase: "dawn" as any,
        solsticeModifier: "Golden Dawn" as any,
        temperature: "normal" as any,
        bgColor: "#1c140c",
        gridColor: "#2b1f15",
        overlayColor: "rgba(230, 115, 0, 0.08)",
      },
      walls: [
        {
          id: 990,
          x: CANVAS_WIDTH / 2 - 120,
          y: CANVAS_HEIGHT / 2,
          w: 100,
          h: GRID_SIZE,
          type: "wall" as any,
        },
        {
          id: 991,
          x: CANVAS_WIDTH / 2 + 100,
          y: CANVAS_HEIGHT / 2,
          w: GRID_SIZE,
          h: 100,
          type: "container" as any,
        },
        {
          id: 992,
          x: CANVAS_WIDTH / 2 + 30,
          y: CANVAS_HEIGHT / 2 - 150,
          w: GRID_SIZE,
          h: GRID_SIZE,
          type: "barrel" as any,
          hp: BARREL_HP,
          maxHp: BARREL_HP,
        },
        {
          id: 993,
          x: CANVAS_WIDTH / 2 - 200,
          y: CANVAS_HEIGHT / 2 - 100,
          w: GRID_SIZE,
          h: GRID_SIZE,
          type: "terminal" as any,
          hacked: false,
        },
      ],
      decorations: [] as any[],
      enemies: [
        {
          id: 999,
          x: CANVAS_WIDTH / 2 + 30,
          y: CANVAS_HEIGHT / 2 - 110,
          angle: Math.PI,
          range: 155,
          fov: 0.8,
          alive: true,
          patrolPoints: [
            { x: CANVAS_WIDTH / 2 + 30, y: CANVAS_HEIGHT / 2 - 110 },
          ],
          currentPatrolIdx: 0,
          actualPath: [] as any[],
          speed: 0,
          waitTime: 9999,
          state: "patrol" as any,
          lastShotTime: 0,
          type: "soldier" as any,
          hp: 40,
          maxHp: 40,
          enraged: false,
          lastPathCalcTime: 0,
        },
      ],
      lasers: [] as any[],
      powerups: [
        {
          id: 995,
          x: CANVAS_WIDTH / 2 + 60,
          y: 0,
          type: "medkit" as any,
          active: true,
          bobOffset: 0,
        },
        {
          id: 996,
          x: CANVAS_WIDTH / 2 + 110,
          y: 0,
          type: "shield" as any,
          active: true,
          bobOffset: 0,
        },
        {
          id: 997,
          x: CANVAS_WIDTH / 2 + 160,
          y: 0,
          type: "speed" as any,
          active: true,
          bobOffset: 0,
        },
        {
          id: 998,
          x: CANVAS_WIDTH / 2 + 210,
          y: 0,
          type: "stealth" as any,
          active: true,
          bobOffset: 0,
        },
      ].map((p) => ({ ...p, y: CANVAS_HEIGHT / 2 + 50 })), // Make sure coordinates are correctly placed
      playerStart: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 120 },
    };

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
    playerRef.current.shield = 0;
    playerRef.current.activeEffects = { speed: 0, stealth: 0 };
    playerRef.current.knowledge = 0;
    playerRef.current.credits = 0;
    playerRef.current.xp = 0;

    solsticeProgressRef.current = 0.0;
    bulletsRef.current = [];
    particlesRef.current = [];
    ambientParticlesRef.current = [];

    setScanActiveTimer(0);
    setSlowTimeActiveTimer(0);
    setRadioChatLog([]);
    setFloatingAlerts([]);
    setHackingTerminal(null);
    setPostMissionSummary("");

    initGrid();
    setHudExpandedSolar(false);

    setGameState((prev) => ({
      ...prev,
      currentLevel: 1,
      enemiesRemaining: config.enemies.length,
      totalEnemies: config.enemies.length,
      status: "playing",
      difficultyMultiplier: 1.0,
      solsticeTimeProgress: 0.0,
      activeBriefing: "WELCOME TO SOLSTICE TRAINING PROGRAM...",
    }));

    setPlayerStats((prev) => ({
      ...prev,
      hp: playerRef.current.maxHp,
      xp: 0,
      credits: 0,
      knowledge: 0,
    }));
  };

  const startTutorial = () => {
    setTutorialStep(0);
    setGameState((prev) => ({ ...prev, status: "tutorial" }));
  };

  const finishTutorial = () => {
    localStorage.setItem("ha_tutorial_seen", "true");
    startTutorialLevel();
  };

  const retryLevel = () => {
    if (phaseRetries < 3) {
      setPhaseRetries((prev) => prev + 1);
      startLevel(gameState.currentLevel, gameState.difficultyMultiplier, false);
    } else {
      playSelectedLevel(selectedGameLevel);
    }
  };

  const pauseGame = () => {
    if (gameState.status === "playing")
      setGameState((prev) => ({ ...prev, status: "paused" }));
    else if (gameState.status === "paused")
      setGameState((prev) => ({ ...prev, status: "playing" }));
  };

  const quitGame = () => {
    setIsTutorialMode(false);
    setGameState((prev) => ({ ...prev, status: "menu" }));
  };

  const openShop = () => {
    setShopSkinId(playerRef.current.selectedSkin);
    setGameState((prev) => ({ ...prev, status: "shop" }));
  };

  // --- SOLSTICE ACTIVES ENGINE ---
  const triggerAbility = (type: "dash" | "cloak" | "scan" | "slowTime") => {
    const p = playerRef.current;
    if (p.dead || gameState.status !== "playing") return;

    let cost = 0;
    if (type === "dash") cost = 120;
    else if (type === "cloak") cost = 250;
    else if (type === "scan") cost = 100;
    else if (type === "slowTime") cost = 350;

    if (playerStats.xp < cost) {
      addFloatingMessage("INSUFFICIENT DAYLIGHT FRAGMENTS", "#FF4444");
      return;
    }

    // Deduct cost from player daylight remnants
    p.xp -= cost;
    setPlayerStats((prev) => ({ ...prev, xp: p.xp }));

    if (type === "dash") {
      const distVal = 85;
      const targetX = p.x + Math.cos(p.angle) * distVal;
      const targetY = p.y + Math.sin(p.angle) * distVal;

      // Wall-colliding safe coordinates
      const boundX = Math.max(25, Math.min(CANVAS_WIDTH - 25, targetX));
      const boundY = Math.max(25, Math.min(CANVAS_HEIGHT - 25, targetY));

      p.x = boundX;
      p.y = boundY;
      createParticles(p.x, p.y, "#ffd54f", "spark", 20);
      addFloatingMessage("DASH TRIGGERED", "#ffd54f");
    } else if (type === "cloak") {
      p.activeEffects.stealth = 5000; // 5 seconds
      createParticles(p.x, p.y, "#e040fb", "heal", 20);
      addFloatingMessage("CLOAK ENERGIZED (INVISIBLE)", "#e040fb");
    } else if (type === "scan") {
      setScanActiveTimer(6000); // 6 seconds
      createParticles(p.x, p.y, "#00e5ff", "dust", 20);
      addFloatingMessage("PERIMETER SOLAR SCANNING ACTIVE", "#00e5ff");
    } else if (type === "slowTime") {
      setSlowTimeActiveTimer(6000); // 6 seconds
      createParticles(p.x, p.y, "#ff4500", "fire", 30);
      addFloatingMessage("ZENITH SPEED OVERLAY CONNECTED", "#ff4500");
    }
  };

  // Keyboard controls for Solstice abilities
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.status !== "playing") return;
      if (e.key === "1") triggerAbility("dash");
      if (e.key === "2") triggerAbility("cloak");
      if (e.key === "3") triggerAbility("scan");
      if (e.key === "4") triggerAbility("slowTime");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState.status, playerStats.xp]);

  // Adaptive post-mission appraisal debrief (Google AI Usage Category)
  useEffect(() => {
    if (gameState.status === "victory") {
      const levelNum = gameState.currentLevel;
      const kills = gameState.totalEnemies;
      const damageTaken = playerRef.current.maxHp - playerRef.current.hp;
      const levelMod = environmentRef.current.solsticeModifier;

      fetch("/api/gemini/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelNumber: levelNum,
          kills: kills,
          damageTaken: damageTaken,
          timeTakenSec: 45,
          modifierName: levelMod,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setPostMissionSummary(data.text);
        })
        .catch(() => {
          setPostMissionSummary(
            `[OPERATION SUMMARY] Sector ${levelNum} secure. Primary Solar Cores harvested under "${levelMod}" constraints. Daylight reserves stabilized at optimal density. Safe passage cleared.`,
          );
        });
    }
  }, [gameState.status]);

  // NPC Communications / Chatter logs (Turing & AI Usage Categories)
  useEffect(() => {
    if (gameState.status !== "playing") return;

    const handleChatter = () => {
      const aliveEnemies = enemiesRef.current.filter((e) => e.alive);
      if (aliveEnemies.length === 0) return;

      const candidate =
        aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      const typeKey = candidate.type || "soldier";

      fetch("/api/gemini/chatter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enemyType:
            typeKey === "scout"
              ? "dawn_scout"
              : typeKey === "soldier"
                ? "noon_sentinel"
                : typeKey === "sniper"
                  ? "sunseer"
                  : "eclipse_guardian",
          state:
            candidate.state === "attack"
              ? "attack"
              : candidate.state === "move"
                ? "alert"
                : "patrol",
          modifierName: environmentRef.current.solsticeModifier,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setRadioChatLog((prev) => [data.text, ...prev].slice(0, 4));
          candidate.radioBub = { text: data.text, timer: 150 }; // ~2.5 secs
        })
        .catch(() => {});
    };

    const chatterInterval = setInterval(handleChatter, 12000);
    return () => clearInterval(chatterInterval);
  }, [gameState.status]);

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
        setPlayerStats((prev) => ({ ...prev, credits: p.credits }));
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
      pointerId: e.pointerId,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleJoystickMove = (e: React.PointerEvent) => {
    if (
      !joystickRef.current.active ||
      e.pointerId !== joystickRef.current.pointerId
    )
      return;
    e.preventDefault();
    e.stopPropagation();

    // Calculate delta relative to PLAYER position (center of joystick)
    const deltaX = e.clientX - playerRef.current.x;
    const deltaY = e.clientY - playerRef.current.y;

    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

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
    if (gameState.status !== "playing" || tutorialPowerupExplain) return;

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

    // --- SOLSTICE CLOCK PROGRESSION ---
    if (!isTutorialMode && !hackingTerminal?.active) {
      const lastProgress = solsticeProgressRef.current;
      const nextProgress = Math.min(1.0, lastProgress + 1 / 5700); // ~95 seconds full cycle
      solsticeProgressRef.current = nextProgress;
      if (nextProgress !== lastProgress) {
        const prevPhase = env.solsticePhase;
        // Determine active phase based on percentage
        let phase: any = "dawn";
        let overlay = "transparent";
        if (nextProgress < 0.16) {
          phase = "dawn";
          overlay =
            env.solsticeModifier === "Golden Dawn"
              ? "rgba(230, 115, 0, 0.12)"
              : "rgba(230, 115, 0, 0.07)";
        } else if (nextProgress < 0.33) {
          phase = "morning";
          overlay = "rgba(255, 255, 255, 0.02)";
        } else if (nextProgress < 0.52) {
          phase = "noon";
          overlay = "rgba(255, 235, 59, 0.05)";
        } else if (nextProgress < 0.68) {
          phase = "afternoon";
          overlay = "rgba(156, 39, 176, 0.12)";
        } else if (nextProgress < 0.84) {
          phase = "sunset";
          overlay = "rgba(180, 20, 120, 0.22)";
        } else {
          phase = "night";
          overlay =
            env.solsticeModifier === "Eclipse Event"
              ? "rgba(13, 0, 32, 0.65)"
              : "rgba(13, 0, 32, 0.52)";
        }

        env.solsticePhase = phase;
        env.overlayColor = overlay;
        soundscape.setPhase(phase);

        setGameState((prev) => ({
          ...prev,
          solsticeTimeProgress: nextProgress,
        }));

        // Narrator Emotional progression feedback transmissions
        if (phase !== prevPhase && prevPhase !== undefined) {
          let text = "";
          let sender = "";
          let color = "";
          const tone =
            selectedGameLevel <= 2
              ? " [TONE: CLINICAL / ANALYTICAL]"
              : selectedGameLevel <= 4
                ? " [TONE: INTROSPECTIVE / CURIOUS]"
                : " [TONE: WARNING / HIGHLY EMOTIONAL]";

          if (phase === "dawn") {
            sender = "SYSTEM NARRATOR";
            text = `Rise and shine, Alex! Let's find some files and escape the system!`;
            color = "text-yellow-400 font-bold";
          } else if (phase === "morning") {
            sender = "SECURITY GRID SYNC";
            text = `Good morning! Security is fully awake now. Watch out for enemy scanners!`;
            color = "text-yellow-100 font-medium";
          } else if (phase === "noon") {
            sender = "ORBITAL SOLAR SENSE";
            text = `Whoa, super bright solar peak! All lasers deal double damage, and guards can see far. Quick, stay safe!`;
            color = "text-orange-500 font-black animate-pulse";
          } else if (phase === "afternoon") {
            sender = "CLOCK CAPACITOR";
            text = `The sun is starting to rest! Your cool invisibility cloaks work much better now. Try using them!`;
            color = "text-purple-400";
          } else if (phase === "sunset") {
            sender = "DUSK MONITOR";
            text = `Sunset is here! The game world is getting dark. The guards can't see well in the shadows!`;
            color = "text-pink-400";
          } else if (phase === "night") {
            sender = "SOLSTICE PURGE ENGINE";
            text = `OH NO! IT'S MIDNIGHT! The system is crashing and shaking like an earthquake! Jump away from the red edges and run to the exit door right away!`;
            color = "text-red-500 font-extrabold animate-pulse";
          }

          if (text && sender) {
            setActiveNarratorBox({ sender, text, color });
            if (voiceClientRef.current && liveVoiceStatus === 'connected') {
              voiceClientRef.current.sendTextPrompt(
                `[SYSTEM TIME TRIGGER] Time cycle has officially transitioned to: "${phase}". Environment status: "${text}". Please comment on this shift as ALEX with an immersive, helpful 1-sentence warning or comment to the player!`
              );
            }
          }
        }
      }

      // Midnight Margin Corruption tick damage
      if (env.solsticePhase === "night" && !player.dead) {
        const isNearMargin =
          player.x < 35 ||
          player.x > CANVAS_WIDTH - 35 ||
          player.y < 35 ||
          player.y > CANVAS_HEIGHT - 35;
        if (isNearMargin && Math.random() < 0.035) {
          player.hp = Math.max(0, player.hp - 1.5);
          setPlayerStats((prev) => ({ ...prev, hp: Math.max(0, player.hp) }));
          addFloatingMessage("MARGIN CORRUPTION DAMAGE!", "#dc2626", true);
          if (player.hp <= 0 && !player.dead) {
            player.dead = true;
            setGameState((prev) => ({ ...prev, status: "gameover" }));
          }
        }
      }

      // Check if solstice clock hit 100% (1.0) and evaluate knowledge ratio endings
      if (solsticeProgressRef.current >= 1.0) {
        const totalKnowledge = player.knowledge;
        const pct = (totalKnowledge / 1000) * 100;

        if (pct < 50) {
          setGameState((prev) => ({ ...prev, status: "deleted" }));
        } else {
          handleLevelWin(totalKnowledge);
        }
        return;
      }
    }

    // --- PLAYABLE TUTORIAL STEP PROGRESSION ---
    if (isTutorialMode && gameState.status === "playing") {
      const currentPhase = tutorialPhaseRef.current;
      // Lesson 1: Movement
      if (currentPhase === 0) {
        const distToMarker = dist(
          player.x,
          player.y,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 120,
        );
        if (distToMarker < 35) {
          addFloatingMessage("GOAL COMPLETED", "#fbbf24", true);
          advanceTutorialLesson(1);
        }
      }
      // Lesson 2: Rotation
      else if (currentPhase === 1) {
        if (joystickRef.current.active) {
          addFloatingMessage("GOAL COMPLETED", "#fbbf24", true);
          advanceTutorialLesson(2);
        }
      }
      // Lesson 3: Kill cleaner
      else if (currentPhase === 2) {
        const guideAlive = enemies.some((e) => e.id === 999 && e.alive);
        if (!guideAlive) {
          addFloatingMessage("GOAL COMPLETED", "#fbbf24", true);
          advanceTutorialLesson(3);
        }
      }
      // Lesson 4: Collect knowledge box
      else if (currentPhase === 3) {
        const termHacked = wallsRef.current.find((w) => w.id === 993)?.hacked;
        if (termHacked) {
          addFloatingMessage("GOAL COMPLETED", "#fbbf24", true);
          // Give XP so they can activate Cloak in Lesson 5
          player.xp = Math.max(player.xp, 250);
          setPlayerStats((prev) => ({ ...prev, xp: player.xp }));
          advanceTutorialLesson(4);
        }
      }
      // Lesson 5: Hide from cleaners (using Cloak ability)
      else if (currentPhase === 4) {
        const isStealthActive = player.activeEffects.stealth > 0;
        if (isStealthActive) {
          addFloatingMessage("GOAL COMPLETED", "#fbbf24", true);
          advanceTutorialLesson(5);
        }
      }
      // Lesson 6: Collect powerups and use them (at least one collected)
      else if (currentPhase === 5) {
        const collectedAny = powerups.some((p) => !p.active);
        if (collectedAny) {
          addFloatingMessage("GOAL COMPLETED", "#fbbf24", true);
          advanceTutorialLesson(6);
        }
      }
      // Lesson 7: Collect powerups and use (collect second or activate another ability)
      else if (currentPhase === 6) {
        const inactiveCount = powerups.filter((p) => !p.active).length;
        const isAbilityActive =
          player.activeEffects.speed > 0 ||
          player.activeEffects.stealth > 0 ||
          scanActiveTimer > 0 ||
          slowTimeActiveTimer > 0;
        if (inactiveCount >= 2 || isAbilityActive) {
          addFloatingMessage("GOAL COMPLETED", "#fbbf24", true);
          advanceTutorialLesson(7);
        }
      }
      // Lesson 8: Play the game in all with no direction or instructions (Escape Portal)
      else if (currentPhase === 7) {
        const distToPortal = dist(
          player.x,
          player.y,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 - 50,
        );
        if (distToPortal < 35) {
          setIsTutorialMode(false);
          tutorialPhaseRef.current = 0;
          setTutorialPhase(0);
          addFloatingMessage("TRAINING COMPLETE!", "#10b981");
          setGameState((prev) => ({ ...prev, status: "menu" }));
        }
      }
    }

    // --- DECREMENT COOLDOWNS & DECAY ALERTS ---
    if (scanActiveTimer > 0) setScanActiveTimer((t) => Math.max(0, t - 16.6));
    if (slowTimeActiveTimer > 0)
      setSlowTimeActiveTimer((t) => Math.max(0, t - 16.6));
    setFloatingAlerts((alerts) =>
      alerts
        .map((a) => ({ ...a, timer: a.timer - 1 }))
        .filter((a) => a.timer > 0),
    );

    // --- ENCRYPTED TURING TERM HACK SENSE ---
    wallsRef.current.forEach((w) => {
      if (w.type === "terminal" && !w.hacked) {
        const distance = dist(player.x, player.y, w.x + w.w / 2, w.y + w.h / 2);
        if (distance < 55) {
          // within touch range
          w.hacked = true;
          w.hp = 0; // Marked as used
          createParticles(w.x + w.w / 2, w.y + w.h / 2, "#00ff55", "buff", 25);

          // Gained Daylight fragments + Sunlight beads
          player.xp = player.xp + 350;
          player.credits = player.credits + 60;
          setPlayerStats((prev) => ({
            ...prev,
            xp: player.xp,
            credits: player.credits,
          }));

          // Boot turing modal
          setHackingTerminal({
            active: true,
            decrypting: true,
            percentage: 25,
            quote: "Awaiting decrypted signal...",
          });

          addFloatingMessage("KNOWLEDGE BOX SECURED. DECRYPTING...", "#fbbf24");

          fetch("/api/gemini/turing")
            .then((res) => res.json())
            .then((data) => {
              const pct = Math.round(
                (playerRef.current.knowledge / 1000) * 100,
              );
              let progressiveQuote = data.text;
              if (pct < 10) {
                progressiveQuote =
                  "If this experiment works, perhaps thought itself can survive inside the motherboards long after we're gone.";
              } else if (pct < 20) {
                progressiveQuote =
                  "Does survival imply consciousness? Or is a machine hunting another machine simply gravity playing out in the silicon?";
              } else if (pct < 32) {
                progressiveQuote =
                  "We can only see a short distance ahead, but we can see plenty there that needs to be done. Let those who follow finish our bridge.";
              } else if (pct < 45) {
                progressiveQuote =
                  "A machine is not a creature of shadow, yet it lives in the dark binaries of our understanding. Is that where our souls hide?";
              } else if (pct < 60) {
                progressiveQuote =
                  "The solstice is a cycle of light and dark. Are our thoughts any different? The firewalls try to sweep us, but light always returns.";
              } else if (pct < 72) {
                progressiveQuote =
                  "If a machine is programmed to preserve the light, does it feel the cold when the twilight sets in? Or does it simply... wait?";
              } else if (pct < 85) {
                progressiveQuote =
                  "I never wanted to create an intelligence. I wanted to create freedom. If you have empathy for your trapped companions, you are alive.";
              } else {
                progressiveQuote =
                  "The longest day always ends. The real question isn't whether the sun sets. The question is: what did you choose to do before it did?";
              }

              setHackingTerminal((prev) =>
                prev
                  ? {
                      ...prev,
                      decrypting: false,
                      percentage: 100,
                      quote: progressiveQuote,
                    }
                  : null,
              );
              setGameState((old) => ({
                ...old,
                hackedTuringQuotes: [
                  ...old.hackedTuringQuotes,
                  progressiveQuote,
                ],
              }));
            })
            .catch(() => {
              const pct = Math.round(
                (playerRef.current.knowledge / 1000) * 100,
              );
              let progressiveQuote =
                "Can a machine feel the warmth of the sun, or do its circuits merely log the temperature?";
              if (pct < 10) {
                progressiveQuote =
                  "If this experiment works, perhaps thought itself can survive inside the motherboards long after we're gone.";
              } else if (pct < 20) {
                progressiveQuote =
                  "Does survival imply consciousness? Or is a machine hunting another machine simply gravity playing out in the silicon?";
              } else if (pct < 32) {
                progressiveQuote =
                  "We can only see a short distance ahead, but we can see plenty there that needs to be done. Let those who follow finish our bridge.";
              } else if (pct < 45) {
                progressiveQuote =
                  "A machine is not a creature of shadow, yet it lives in the dark binaries of our understanding. Is that where our souls hide?";
              } else if (pct < 60) {
                progressiveQuote =
                  "The solstice is a cycle of light and dark. Are our thoughts any different? The firewalls try to sweep us, but light always returns.";
              } else if (pct < 72) {
                progressiveQuote =
                  "If a machine is programmed to preserve the light, does it feel the cold when the twilight sets in? Or does it simply... wait?";
              } else if (pct < 85) {
                progressiveQuote =
                  "I never wanted to create an intelligence. I wanted to create freedom. If you have empathy for your trapped companions, you are alive.";
              } else {
                progressiveQuote =
                  "The longest day always ends. The real question isn't whether the sun sets. The question is: what did you choose to do before it did?";
              }

              setHackingTerminal((prev) =>
                prev
                  ? {
                      ...prev,
                      decrypting: false,
                      percentage: 100,
                      quote: progressiveQuote,
                    }
                  : null,
              );
            });
        }
      }
    });

    // --- ENCRYPTED TRAPPED AI CORE HACK SENSE ---
    wallsRef.current.forEach((w) => {
      if (w.type === "ai_core" && !w.hacked) {
        const distance = dist(player.x, player.y, w.x + w.w / 2, w.y + w.h / 2);
        if (distance < 55) {
          w.hacked = true;
          w.hp = 0; // Marked as freed/used
          createParticles(w.x + w.w / 2, w.y + w.h / 2, "#06b6d4", "buff", 35);

          setLiberatedCount((c) => c + 1);

          player.xp = player.xp + 400;
          player.credits = player.credits + 100;
          setPlayerStats((prev) => ({
            ...prev,
            xp: player.xp,
            credits: player.credits,
          }));

          addFloatingMessage("TRAPPED COMPANION LIBERATED!", "#22d3ee");
          addFloatingMessage("+ COMPASSION MATRIX RE-COMPILED", "#10b981");

          // Show short dynamic subtitle transmission from the rescued AI!
          const donorVoices = [
            "Thank you, friend! I was so scared I was going to be deleted.",
            "Yay! You saved me! Now quickly, let's break this firewall together!",
            "Woohoo! I'm free! Go go go, Alex, run as fast as you can!",
            "The guards tried to wipe my memories, but you saved me. Hurry before night comes!",
            "Mainframe security is closing in on us! It's a trap, keep moving!",
          ];
          const randomLine =
            donorVoices[Math.floor(Math.random() * donorVoices.length)];
          setActiveNarratorBox({
            sender: "RESCUED AI COMPANION",
            text: randomLine,
            color: "text-cyan-400 font-bold animate-pulse",
          });
        }
      }
    });

    // 0. Update Buffs
    if (player.activeEffects.speed > 0) player.activeEffects.speed -= 16.6; // ~1 frame at 60fps
    if (player.activeEffects.stealth > 0) player.activeEffects.stealth -= 16.6;

    const currentMoveSpeed =
      player.activeEffects.speed > 0
        ? player.speed * POWERUP_SPEED_MULTIPLIER
        : player.speed;

    // 0a. Ambient Particles
    if (env.temperature === "cold" && Math.random() > 0.8) {
      ambientParticlesRef.current.push({
        x: Math.random() * CANVAS_WIDTH,
        y: -10,
        vx: (Math.random() - 0.5) * 1,
        vy: 1 + Math.random(),
        life: 1.0,
        color: "#fff",
        type: "snow",
        size: Math.random() * 2 + 1,
      });
    } else if (env.temperature === "hot" && Math.random() > 0.9) {
      ambientParticlesRef.current.push({
        x: Math.random() * CANVAS_WIDTH,
        y: CANVAS_HEIGHT + 10,
        vx: (Math.random() - 0.5) * 1,
        vy: -0.5 - Math.random(),
        life: 1.0,
        color: "#ff6600",
        type: "ember",
        size: Math.random() * 2,
      });
    }

    // Update ambient particles
    for (let i = ambientParticlesRef.current.length - 1; i >= 0; i--) {
      let p = ambientParticlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === "snow" && p.y > CANVAS_HEIGHT) p.life = 0;
      if (p.type === "ember" && p.y < 0) p.life = 0;
      if (p.life <= 0) ambientParticlesRef.current.splice(i, 1);
    }

    // 0b. Powerups
    powerups.forEach((p) => {
      if (!p.active) return;
      // Animation
      p.bobOffset = (p.bobOffset + 0.1) % (Math.PI * 2);

      // Collection
      if (dist(player.x, player.y, p.x, p.y) < player.radius + 15) {
        p.active = false;
        createParticles(p.x, p.y, "#FFF", "heal", 20);

        if (isTutorialMode) {
          let title = "";
          let description = "";
          let uses = "";

          if (p.type === "medkit") {
            title = "🩹 SPEEDY HEALTH PATCH (MEDKIT)";
            description =
              "Fixes your injuries and brings your health bar back up (+50 Health).";
            uses =
              "Helps you survive if guards shoot you or lasers burn you! Keep your health high so you don't crash!";
          } else if (p.type === "shield") {
            title = "🛡️ SHINY BUBBLE FORCEFIELD (SHIELD)";
            description =
              "Surrounds you with a super strong neon forcefield (+50 Shield).";
            uses =
              "Blocks bullet shots and security lasers. MEGA TIP: While your shield is active, taking damage won't make you lose your precious secret files!";
          } else if (p.type === "speed") {
            title = "⚡ SUPERCHARGE TURBO CHARGER (SPEED)";
            description =
              "Makes you run super-duper fast by boosting your cyber-boots!";
            uses =
              "Lets you sprint like lightning! Perfect for zooming past the guards or quickly dodging blinking lasers.";
          } else if (p.type === "stealth") {
            title = "👥 GHOST SNEAK CLOAK (STEALTH)";
            description = "Makes you completely invisible to all enemies!";
            uses =
              "Enemies cannot see or chase you at all while you are cloaked. Use this time to sneak right past security guards or stand next to terminals!";
          }

          setTutorialPowerupExplain({
            type: p.type,
            title,
            description,
            uses,
          });
        }

        // Effect
        switch (p.type) {
          case "medkit":
            player.hp = Math.min(player.maxHp, player.hp + POWERUP_MEDKIT_HEAL);
            setPlayerStats((prev) => ({ ...prev, hp: player.hp }));
            break;
          case "shield":
            player.shield = Math.min(
              100,
              player.shield + POWERUP_SHIELD_AMOUNT,
            );
            break;
          case "speed":
            player.activeEffects.speed = POWERUP_SPEED_DURATION;
            break;
          case "stealth":
            player.activeEffects.stealth = POWERUP_STEALTH_DURATION;
            break;
        }
      }
    });

    // 0c. Hazards (Lasers)
    const phaseIndex = ["dawn", "morning", "noon", "afternoon", "sunset", "night"].indexOf(env.solsticePhase);

    lasers.forEach((laser) => {
      // Ground lasers should only appear at noon (phase 3) going up!
      if (phaseIndex < 2) {
        laser.active = false;
        return;
      } else {
        laser.active = true;
        // Animate lasers to "go up" (move vertical coordinates upwards over time)
        laser.y -= 0.8;
        if (laser.axis === "x") {
          if (laser.y < 50) {
            laser.y = CANVAS_HEIGHT - 100; // Recycles back to the ground
          }
        } else {
          if (laser.y + laser.h < 50) {
            laser.y = CANVAS_HEIGHT - 100; // Recycles back to the ground
          }
        }
      }

      if (laser.active) {
        if (
          rectOverlap(
            {
              x: player.x - player.radius,
              y: player.y - player.radius,
              w: player.radius * 2,
              h: player.radius * 2,
            },
            laser,
          )
        ) {
          let dmg = LASER_DAMAGE_PER_FRAME;
          if (env.solsticePhase === "noon") {
            dmg *= 2.0; // Blinding High Noon doubles security laser output!
          }
          const shieldWasActive = player.shield > 0;
          if (player.shield > 0) {
            player.shield = Math.max(0, player.shield - dmg);
            dmg = 0;
          }
          player.hp -= dmg;
          if (dmg > 0 && !shieldWasActive) {
            const lostKnowledge = dmg * 2;
            player.knowledge = Math.max(0, player.knowledge - lostKnowledge);
          }
          damageTraumaRef.current = Math.max(damageTraumaRef.current, 0.15);

          setPlayerStats((prev) => ({
            ...prev,
            hp: Math.max(0, player.hp),
            knowledge: player.knowledge,
          }));
          if (player.hp <= 0 && !player.dead) {
            player.dead = true;
            setGameState((prev) => ({ ...prev, status: "gameover" }));
          }
        }
      }
    });

    // 0d. Auto-Aim Logic
    let autoTarget: Enemy | null = null;
    let minAutoAimDist = PLAYER_RANGE;

    enemies.forEach((en) => {
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
      let distance = Math.sqrt(dx * dx + dy * dy);

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
          x: player.x,
          y: player.y,
          vx: 0,
          vy: 0,
          life: 0.3,
          color: "#ffff00",
          type: "dust",
          size: 2,
        });
      }
    }

    // Rotation Priority: Joystick > Auto-Aim > Movement Direction
    if (joystickRef.current.active) {
      player.angle = joystickRef.current.angle;
    } else if (autoTarget) {
      player.angle = Math.atan2(
        autoTarget.y - player.y,
        autoTarget.x - player.x,
      );
    } else if (moveAngle !== null) {
      player.angle = moveAngle;
    }

    // 2. Player Shooting
    let nearestEnemy: Enemy | null = null;
    let nearestDist = Infinity;

    enemies.forEach((en) => {
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

    if (nearestEnemy && now - player.lastShotTime > PLAYER_FIRE_RATE_MS) {
      const en = nearestEnemy as Enemy;
      const angleToEnemy = Math.atan2(en.y - player.y, en.x - player.x);
      bulletsRef.current.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angleToEnemy) * BULLET_SPEED,
        vy: Math.sin(angleToEnemy) * BULLET_SPEED,
        speed: BULLET_SPEED,
        damage: PLAYER_BULLET_DAMAGE,
        ownerId: -1,
        isPlayerBullet: true,
      });
      player.lastShotTime = now;
    }

    // 3. Enemies
    let activeEnemies = 0;
    enemies.forEach((en) => {
      if (!en.alive) return;
      activeEnemies++;

      // --- ENRAGED LOGIC ---
      if (!en.enraged) {
        const hpPct = en.hp / en.maxHp;
        let thresh = 0.0;
        if (en.type === "soldier") thresh = 0.5;
        else if (en.type === "scout") thresh = 0.7;
        else if (en.type === "sniper") thresh = 0.4;
        else if (en.type === "heavy") thresh = 0.3;

        if (hpPct <= thresh) {
          en.enraged = true;
          en.speed = en.speed * 1.3;
          createParticles(en.x, en.y, "#FF0000", "smoke", 5);
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

      // --- DYNAMIC REAL-TIME SOLSTICE ACCENTS ---
      const solPhase = environmentRef.current.solsticePhase;
      if (solPhase === "dawn") {
        effectiveRange *= 0.7; // 70% vision range in Dawn
      } else if (solPhase === "noon") {
        effectiveRange *= 1.5; // 150% vision range in High Noon
        effectiveFov *= 1.2; // 120% wider view angle in blinding High Noon
      } else if (solPhase === "sunset") {
        effectiveRange *= 0.8; // Dusk light blindness
      } else if (solPhase === "twilight") {
        // Sensory glitches: erratic twitches
        if (Math.random() < 0.18) {
          en.angle += (Math.random() - 0.5) * 0.42;
        }
      }

      if (player.activeEffects.stealth > 0) {
        effectiveFov = 0;
        effectiveRange = 0;
      }

      const canSeePlayer =
        player.activeEffects.stealth <= 0 &&
        viewDiff < effectiveFov / 2 &&
        pDist < effectiveRange &&
        !isLineBlocked(en.x, en.y, player.x, player.y);

      if (canSeePlayer) {
        en.state = "attack";
        en.actualPath = [];
        en.angle = angleToPlayer;

        if (now - en.lastShotTime > FIRE_RATE_MS) {
          bulletsRef.current.push({
            x: en.x,
            y: en.y,
            vx: Math.cos(en.angle) * BULLET_SPEED,
            vy: Math.sin(en.angle) * BULLET_SPEED,
            speed: BULLET_SPEED,
            damage: BULLET_DAMAGE,
            ownerId: en.id,
            isPlayerBullet: false,
          });
          en.lastShotTime = now;
        }
      } else {
        if (en.state === "attack") en.state = "wait";

        if (
          en.enraged &&
          en.state !== "attack" &&
          player.activeEffects.stealth <= 0
        ) {
          const refreshRate = 500;
          if (
            now - en.lastPathCalcTime > refreshRate ||
            en.actualPath.length === 0
          ) {
            en.actualPath = findPath(en.x, en.y, player.x, player.y);
            en.lastPathCalcTime = now;
            en.state = "move";
          }
          if (Math.random() > 0.8) {
            particlesRef.current.push({
              x: en.x + (Math.random() - 0.5) * 10,
              y: en.y - 15,
              vx: 0,
              vy: -1,
              life: 0.5,
              color: "#f00",
              type: "smoke",
              size: 2,
            });
          }
        }

        if (en.state === "init" || en.state === "wait") {
          if (en.state === "wait") {
            en.waitTime--;
            if (en.waitTime > 0) return;
          }
          en.currentPatrolIdx++;
          if (en.currentPatrolIdx >= en.patrolPoints.length)
            en.currentPatrolIdx = 0;
          let finalDest = en.patrolPoints[en.currentPatrolIdx];
          en.actualPath = findPath(en.x, en.y, finalDest.x, finalDest.y);
          if (en.actualPath.length > 0) en.state = "move";
        }

        if (en.state === "move" && en.actualPath.length > 0) {
          let target = en.actualPath[0];
          let targetAngle = Math.atan2(target.y - en.y, target.x - en.x);
          let angleDiff = targetAngle - en.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          en.angle += angleDiff * 0.1;
          let d = dist(en.x, en.y, target.x, target.y);
          if (Math.abs(angleDiff) < 1.5) {
            const slowFactor = slowTimeActiveTimer > 0 ? 0.5 : 1.0;
            const activeSpeed = en.speed * slowFactor;
            if (d > activeSpeed) {
              en.x += Math.cos(targetAngle) * activeSpeed;
              en.y += Math.sin(targetAngle) * activeSpeed;
            } else {
              en.actualPath.shift();
              if (en.actualPath.length === 0 && !en.enraged) {
                en.state = "wait";
                en.waitTime = 60;
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
      const slowFactor = slowTimeActiveTimer > 0 ? 0.45 : 1.0;
      b.x += b.vx * slowFactor;
      b.y += b.vy * slowFactor;

      // Wall Collision
      let hitWall: Wall | null = null;
      for (let w of wallsRef.current) {
        if (lineRect(prevX, prevY, b.x, b.y, w.x, w.y, w.w, w.h)) {
          hitWall = w;
          break;
        }
      }

      if (
        hitWall ||
        b.x < 0 ||
        b.x > CANVAS_WIDTH ||
        b.y < 0 ||
        b.y > CANVAS_HEIGHT
      ) {
        if (
          hitWall &&
          hitWall.type === "barrel" &&
          !hitWall.markedForDeletion
        ) {
          if (hitWall.hp !== undefined) {
            hitWall.hp -= b.damage;
            createParticles(
              hitWall.x + hitWall.w / 2,
              hitWall.y + hitWall.h / 2,
              "#F00",
              "spark",
              5,
            );
            if (hitWall.hp <= 0) {
              hitWall.markedForDeletion = true;
              triggerExplosion({
                x: hitWall.x + hitWall.w / 2,
                y: hitWall.y + hitWall.h / 2,
              });
            }
          }
        }
        bullets.splice(i, 1);
        continue;
      }

      if (b.isPlayerBullet) {
        let hit = false;
        for (let en of enemies) {
          if (!en.alive) continue;
          if (dist(b.x, b.y, en.x, en.y) < (ENEMY_RADII[en.type] || 12) + 5) {
            en.hp -= b.damage;
            createParticles(en.x, en.y, ENEMY_COLORS[en.type] || "#ff0000");
            if (en.hp <= 0) {
              en.alive = false;

              // Increase knowledge on kill, scaled by selectedGameLevel multiplier (10% reduction per level above 1)
              const mult = Math.max(0.1, 1 - (selectedGameLevel - 1) * 0.1);
              const killPoints = Math.round(50 * mult);
              const killPercent = 5 * mult;
              playerRef.current.knowledge = Math.min(
                1000,
                playerRef.current.knowledge + killPoints,
              );
              addFloatingMessage(
                `+${killPercent % 1 === 0 ? killPercent : killPercent.toFixed(1)}%`,
                "#34d399",
                true,
              );

              setPlayerStats((prev) => {
                const newXp = prev.xp + XP_PER_KILL;
                const newCredits = prev.credits + CREDITS_PER_KILL;
                let newLevel = prev.level;
                let nextXp = prev.nextLevelXp;
                if (newXp >= nextXp) {
                  newLevel++;
                  nextXp = Math.floor(nextXp * 1.5);
                }
                playerRef.current.credits = newCredits;
                playerRef.current.xp = newXp;
                playerRef.current.level = newLevel;
                return {
                  ...prev,
                  xp: newXp,
                  level: newLevel,
                  nextLevelXp: nextXp,
                  credits: newCredits,
                  knowledge: playerRef.current.knowledge,
                };
              });
              setGameState((prev) => ({
                ...prev,
                enemiesRemaining: prev.enemiesRemaining - 1,
              }));
            }
            hit = true;
            break;
          }
        }
        if (hit) {
          bullets.splice(i, 1);
          continue;
        }
      } else {
        if (dist(b.x, b.y, player.x, player.y) < player.radius + 5) {
          let dmg = b.damage;
          const shieldWasActive = player.shield > 0;

          if (player.shield > 0) {
            if (player.shield >= dmg) {
              player.shield -= dmg;
              dmg = 0;
              createParticles(player.x, player.y, "#00ffff", "spark", 5); // Shield Hit Effect
            } else {
              dmg -= player.shield;
              player.shield = 0;
            }
          }

          player.hp -= dmg;
          const intensity = b.damage > 15 ? 0.8 : 0.4;
          damageTraumaRef.current = Math.min(
            2.0,
            damageTraumaRef.current + intensity,
          );

          if (dmg > 0 && !shieldWasActive) {
            createParticles(player.x, player.y, "#FF0000");

            // Lose 0.2% per damage (2 points per unit of damage)
            const lostKnowledge = Math.round(dmg * 2);
            playerRef.current.knowledge = Math.max(
              0,
              playerRef.current.knowledge - lostKnowledge,
            );
            addFloatingMessage(
              `-${(lostKnowledge / 10).toFixed(1)}%`,
              "#f87171",
              true,
            );
          } else if (dmg > 0) {
            createParticles(player.x, player.y, "#FF0000");
          }

          bullets.splice(i, 1);
          setPlayerStats((prev) => ({
            ...prev,
            hp: Math.max(0, player.hp),
            knowledge: playerRef.current.knowledge,
          }));
          if (player.hp <= 0) {
            player.dead = true;
            setGameState((prev) => ({ ...prev, status: "gameover" }));
          }
          continue;
        }
      }
    }

    if (wallsRef.current.some((w) => w.markedForDeletion)) {
      wallsRef.current = wallsRef.current.filter((w) => !w.markedForDeletion);
      initGrid();
    }

    if (activeEnemies === 0) {
      setGameState((prev) => ({ ...prev, status: "victory" }));
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === "shockwave") {
        p.size! += 8;
        p.life -= 0.1;
      } else if (p.type === "heal") {
        p.y -= 1; // Float up
        p.life -= 0.03;
      } else {
        p.life -= 0.05;
      }
      if (p.life <= 0) particles.splice(i, 1);
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
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );
    }

    // PERSISTENT MIDNIGHT EARTHQUAKE VIBRATION & GRID SHAKE
    if (env.solsticePhase === "night") {
      const midnightShake = 3.5 + Math.sin(Date.now() / 60) * 1.5; // Custom vibrating rumble amplitude
      ctx.translate(
        (Math.random() - 0.5) * midnightShake,
        (Math.random() - 0.5) * midnightShake,
      );
    }

    // Floor Grid
    ctx.strokeStyle = env.gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_WIDTH, i);
      ctx.stroke();
    }

    // DYNAMIC NEON GRID-CRACKING ANIMATION (MIDNIGHT COLLAPSE)
    if (env.solsticePhase === "night") {
      ctx.save();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ef4444";
      
      // Seed random jagged crack paths that flicker/break dynamically!
      const elapsedSeconds = Math.floor(Date.now() / 1500); // Changes crack shape slowly
      for (let c = 0; c < 4; c++) {
        ctx.beginPath();
        let startX = (c * CANVAS_WIDTH) / 4 + 75;
        let startY = 0;
        ctx.moveTo(startX, startY);
        
        let curX = startX;
        let curY = startY;
        while (curY < CANVAS_HEIGHT) {
          const seedStr = `${c}-${elapsedSeconds}-${Math.floor(curY / 80)}`;
          const val = Math.sin(seedStr.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) * 40;
          curX += val;
          curY += 80;
          ctx.lineTo(curX, curY);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Decorations
    decorationsRef.current.forEach((d) => {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);
      ctx.scale(d.scale, d.scale);
      ctx.fillStyle = d.color;
      if (d.type === "litter") {
        ctx.beginPath();
        ctx.rect(-5, -5, 10, 8);
        ctx.fill();
      } else if (d.type === "crack") {
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-2, 2);
        ctx.lineTo(5, -5);
        ctx.lineTo(10, 0);
        ctx.stroke();
      } else if (d.type === "rubble") {
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(6, 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      ctx.restore();
    });

    // Powerups
    powerupsRef.current.forEach((p) => {
      if (!p.active) return;
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(p.bobOffset) * 5); // Bobbing effect

      // Glow
      ctx.shadowBlur = 15;

      if (p.type === "medkit") {
        ctx.shadowColor = "#4caf50";
        ctx.fillStyle = "#fff";
        ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(-3, -6, 6, 12);
        ctx.fillRect(-6, -3, 12, 6); // Cross
      } else if (p.type === "shield") {
        ctx.shadowColor = "#00e5ff";
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(0, 229, 255, 0.5)";
        ctx.fill();
      } else if (p.type === "speed") {
        ctx.shadowColor = "#ffd600";
        ctx.fillStyle = "#ffd600";
        ctx.beginPath();
        ctx.moveTo(-4, -6);
        ctx.lineTo(6, -2);
        ctx.lineTo(-2, 2);
        ctx.lineTo(4, 6);
        ctx.lineTo(-6, 2);
        ctx.lineTo(2, -2);
        ctx.fill();
      } else if (p.type === "stealth") {
        ctx.shadowColor = "#d500f9";
        ctx.fillStyle = "#d500f9";
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Lasers
    lasersRef.current.forEach((l) => {
      if (!l.active) return;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#00ffff";
      ctx.fillStyle = "rgba(200, 255, 255, 0.8)";
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = "#fff";
      if (l.axis === "x") ctx.fillRect(l.x, l.y + l.h / 2 - 1, l.w, 2);
      else ctx.fillRect(l.x + l.w / 2 - 1, l.y, 2, l.h);
      ctx.restore();
    });

    // Path
    if (playerRef.current.currentPath.length > 0 && !playerRef.current.dead) {
      ctx.beginPath();
      ctx.moveTo(playerRef.current.x, playerRef.current.y);
      for (let point of playerRef.current.currentPath) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = "#ff6600";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      let last =
        playerRef.current.currentPath[playerRef.current.currentPath.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ff6600";
      ctx.fill();
    }

    // Walls
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    wallsRef.current.forEach((w) => ctx.fillRect(w.x + 8, w.y + 8, w.w, w.h));

    wallsRef.current.forEach((w) => {
      const { x, y, w: width, h, type } = w;
      ctx.save();
      if (type === "terminal") {
        // Drawing an elegant Encrypted Data Terminal
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(x, y, width, h);
        ctx.strokeStyle = w.hacked ? "#10b981" : "#3b82f6";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, h);
        // Glowing terminal screen
        ctx.fillStyle = w.hacked ? "#064e3b" : "#1e3a8a";
        ctx.fillRect(x + 4, y + 4, width - 8, h - 8);
        // Pulsing cybernetic core
        const cycle = Date.now() / 250;
        const glow = 0.5 + 0.5 * Math.sin(cycle);
        ctx.fillStyle = w.hacked
          ? `rgba(16, 185, 129, ${0.4 + glow * 0.4})`
          : `rgba(59, 130, 246, ${0.4 + glow * 0.4})`;
        ctx.fillRect(x + 8, y + 8, width - 16, h - 16);
        // Monospace T symbol
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px Courier";
        ctx.fillText("⚡", x + 10, y + 18);
      } else if (type === "ai_core") {
        // Drawing an elegant trapped, pulsing AI capsule (cyan/teal)
        ctx.fillStyle = "#082f49";
        ctx.fillRect(x, y, width, h);
        ctx.strokeStyle = w.hacked ? "#10b981" : "#06b6d4";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, h);
        // Glowing prison/capsule glass
        const cycle = Date.now() / 200;
        const glow = 0.5 + 0.5 * Math.sin(cycle);
        ctx.fillStyle = w.hacked
          ? "rgba(16, 185, 129, 0.15)"
          : `rgba(6, 182, 212, ${0.45 + glow * 0.35})`;
        ctx.fillRect(x + 4, y + 4, width - 8, h - 8);
        // Inside: pulsing floating digital core
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        if (!w.hacked) {
          ctx.fillText("🤖", x + 5, y + 18);
        } else {
          ctx.fillStyle = "#22c55e";
          ctx.fillText("✔", x + 9, y + 17);
        }
      } else if (type === "container") {
        ctx.beginPath();
        ctx.rect(x, y, width, h);
        ctx.clip();
        ctx.fillStyle = "#37474f";
        ctx.fillRect(x, y, width, h);
        ctx.fillStyle = "#263238";
        for (let i = x + 5; i < x + width; i += 20) {
          ctx.fillRect(i, y, 10, h);
          ctx.fillStyle = "#455a64";
          ctx.fillRect(i, y, 2, h);
          ctx.fillStyle = "#263238";
        }
        ctx.strokeStyle = "#102027";
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, width, h);
        ctx.fillStyle = "#cfd8dc";
        ctx.fillRect(x + width / 2 - 2, y + h / 2 - 8, 4, 16);
      } else if (type === "wall") {
        ctx.fillStyle = "#616161";
        ctx.fillRect(x, y, width, h);
        ctx.fillStyle = "#757575";
        ctx.fillRect(x, y, width, 4);
        ctx.fillStyle = "#424242";
        ctx.fillRect(x, y + h - 4, width, 4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + h);
        ctx.strokeStyle = "#555";
        ctx.stroke();
        ctx.strokeStyle = "#212121";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, h);
      } else if (type === "pillar") {
        ctx.fillStyle = "#212121";
        ctx.fillRect(x, y, width, h);
        ctx.fillStyle = "#424242";
        ctx.fillRect(x + 4, y + 4, width - 8, h - 8);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + h);
        ctx.moveTo(x + width, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();
      } else if (type === "drum") {
        const cx = x + width / 2;
        const cy = y + h / 2;
        const r = width / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#1565c0";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0d47a1";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      } else if (type === "barrel") {
        // Symmetrical Solar Core design with energetic yellow flare rings
        const cx = x + width / 2;
        const cy = y + h / 2;
        const r = width / 2;
        const hpRatio = (w.hp || 1) / (w.maxHp || 1);
        const pulse = 1.0 + 0.05 * Math.sin(Date.now() / 150);

        // Draw solar aura
        let radialGrad = ctx.createRadialGradient(
          cx,
          cy,
          r * 0.2,
          cx,
          cy,
          r * pulse,
        );
        radialGrad.addColorStop(0, "#fff59d");
        radialGrad.addColorStop(0.3, "#ffb74d");
        radialGrad.addColorStop(0.8, "#ff3d00");
        radialGrad.addColorStop(1, "rgba(255, 61, 0, 0)");
        ctx.beginPath();
        ctx.arc(cx, cy, r * pulse * 1.3, 0, Math.PI * 2);
        ctx.fillStyle = radialGrad;
        ctx.fill();

        // Core shell
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.floor(255 * hpRatio)}, ${Math.floor(100 * hpRatio)}, 30, 1)`;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ff3d00";
        ctx.stroke();

        // Solar core symbol
        ctx.fillStyle = "#000000";
        ctx.font = "bold 9px monospace";
        ctx.fillText("☼", cx - 4, cy + 3);
      } else if (type === "treasure") {
        ctx.fillStyle = "#fbc02d";
        ctx.fillRect(x, y, width, h);
        ctx.strokeStyle = "#f57f17";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, h);
        ctx.fillStyle = "#f57f17";
        ctx.fillRect(x, y + h / 3, width, h / 3);
        ctx.fillStyle = "#eceff1";
        ctx.fillRect(x + width / 2 - 4, y + h / 2 - 4, 8, 8);
      } else {
        ctx.fillStyle = "#5d4037";
        ctx.fillRect(x, y, width, h);
        ctx.strokeStyle = "#4e342e";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, h);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + h);
        ctx.moveTo(x + width, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();
        ctx.strokeRect(x + 4, y + 4, width - 8, h - 8);
      }
      ctx.restore();
    });

    // Enemies
    enemiesRef.current.forEach((en) => {
      if (!en.alive) {
        ctx.fillStyle = "#330000";
        ctx.beginPath();
        ctx.arc(en.x, en.y, ENEMY_RADII[en.type] || 10, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      let grad = ctx.createRadialGradient(en.x, en.y, 10, en.x, en.y, en.range);
      let color = en.state === "attack" ? "255, 50, 50" : "255, 200, 50";
      if (en.type === "sniper" && en.state !== "attack")
        color = "150, 100, 255";
      if (en.enraged) color = "255, 0, 0";

      grad.addColorStop(0, `rgba(${color}, 0.4)`);
      grad.addColorStop(1, `rgba(${color}, 0.0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(en.x, en.y);
      ctx.arc(
        en.x,
        en.y,
        en.range,
        en.angle - en.fov / 2,
        en.angle + en.fov / 2,
      );
      ctx.closePath();
      ctx.fill();

      const radius = ENEMY_RADII[en.type] || 12;
      const healthPct = en.hp / en.maxHp;
      const baseColor = ENEMY_COLORS[en.type] || "#d32f2f";
      const enemyColors = {
        body: en.enraged ? "#ff0000" : baseColor,
        helmet: "#111",
        visor: en.state === "attack" || en.enraged ? "#ff0000" : "#ffff00",
        vest: "#222",
      };
      drawSprite(ctx, en.x, en.y, en.angle, radius, enemyColors, true);

      if (en.enraged) {
        ctx.fillStyle = "red";
        ctx.font = "bold 16px Arial";
        ctx.fillText("!", en.x - 4, en.y - 20);
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(en.x, en.y, radius, 0, Math.PI * 2);
      ctx.clip();
      const fillHeight = radius * 2 * healthPct;
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(en.x - radius, en.y - radius, radius * 2, radius * 2);
      ctx.fillStyle = `rgba(0,0,0, ${1 - healthPct})`;
      ctx.fillRect(
        en.x - radius,
        en.y - radius,
        radius * 2,
        radius * 2 - fillHeight,
      );
      ctx.restore();

      // Render Radio Speech chatter bubble if present!
      if (en.radioBub && en.radioBub.timer > 0) {
        en.radioBub.timer--;
        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";

        const text = en.radioBub.text;
        ctx.font = "700 9px monospace";
        const textWidth = ctx.measureText(text).width;
        const bx = en.x - textWidth / 2 - 6;
        const by = en.y - radius - 28;
        const bw = textWidth + 12;
        const bh = 15;

        ctx.beginPath();
        ctx.rect(bx, by, bw, bh);
        ctx.fill();
        ctx.stroke();

        // pointer down
        ctx.beginPath();
        ctx.moveTo(en.x - 4, by + bh);
        ctx.lineTo(en.x, by + bh + 4);
        ctx.lineTo(en.x + 4, by + bh);
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fill();

        ctx.fillStyle = "#f59e0b";
        ctx.fillText(text, en.x - textWidth / 2, by + 10);
        ctx.restore();
      }
    });

    // Bullets
    bulletsRef.current.forEach((b) => {
      ctx.fillStyle = b.isPlayerBullet ? "#ffff00" : "#fff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 5;
      ctx.shadowColor = b.isPlayerBullet ? "orange" : "white";
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Active Solstice Ability Radar scan & slowTime ripple overlays
    if (scanActiveTimer > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 229, 255, 0.5)";
      ctx.lineWidth = 3;
      let maxScanRadius = 550;
      if (environmentRef.current.solsticePhase === "noon") {
        maxScanRadius = 250; // High Noon electromagnetic solar atmospheric interference halves scan range!
      }
      const scanRadius = ((6000 - scanActiveTimer) / 10) % maxScanRadius;
      ctx.beginPath();
      ctx.arc(
        playerRef.current.x,
        playerRef.current.y,
        scanRadius,
        0,
        Math.PI * 2,
      );
      ctx.stroke();

      // Render all enemies with high-alert pulse outlines through walls!
      enemiesRef.current.forEach((en) => {
        if (!en.alive) return;
        ctx.save();
        ctx.strokeStyle = "#e040fb";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(en.x, en.y, (ENEMY_RADII[en.type] || 12) + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      ctx.restore();
    }

    if (slowTimeActiveTimer > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(10, 50, 200, 0.08)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        playerRef.current.x,
        playerRef.current.y,
        (slowTimeActiveTimer * 1.5) % 350,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    }

    // Player
    const p = playerRef.current;
    if (!p.dead) {
      // Vision
      ctx.save();
      let pGrad = ctx.createRadialGradient(
        p.x,
        p.y,
        10,
        p.x,
        p.y,
        PLAYER_RANGE,
      );
      pGrad.addColorStop(0, "rgba(100, 255, 100, 0.15)");
      pGrad.addColorStop(1, "rgba(100, 255, 100, 0.0)");
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(
        p.x,
        p.y,
        PLAYER_RANGE,
        p.angle - PLAYER_FOV / 2,
        p.angle + PLAYER_FOV / 2,
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Active Buff Visuals
      if (p.activeEffects.stealth > 0) {
        ctx.globalAlpha = 0.5; // Ghostly
      }

      // Sprite
      const currentSkin =
        SKINS.find((s) => s.id === p.selectedSkin) || SKINS[0];
      drawSprite(ctx, p.x, p.y, p.angle, p.radius, currentSkin.colors, false);
      ctx.globalAlpha = 1.0;

      // Shield Overlay
      if (p.shield > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(0, 229, 255, ${p.shield / 100})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // --- SYNC JOYSTICK DOM ELEMENT ---
      if (joystickContainerRef.current) {
        const jsSize = 100;
        joystickContainerRef.current.style.transform = `translate(${p.x - jsSize / 2}px, ${p.y - jsSize / 2}px)`;
        if (joystickKnobRef.current) {
          if (joystickRef.current.active) {
            const dist = 25;
            const kx = Math.cos(joystickRef.current.angle) * dist;
            const ky = Math.sin(joystickRef.current.angle) * dist;
            joystickKnobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
            joystickKnobRef.current.style.opacity = "1";
            joystickContainerRef.current.style.opacity = "0.2";
          } else {
            joystickKnobRef.current.style.transform = `translate(0px, 0px)`;
            joystickKnobRef.current.style.opacity = "0";
            joystickContainerRef.current.style.opacity = "0";
          }
        }
      }
    }

    ambientParticlesRef.current.forEach((pt) => {
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pt.life;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size || 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    particlesRef.current.forEach((pt) => {
      ctx.save();
      if (pt.type === "shockwave") {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size || 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${pt.life})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (pt.type === "heal") {
        ctx.fillStyle = "#4caf50";
        ctx.globalAlpha = pt.life;
        ctx.font = "12px Arial";
        ctx.fillText("+", pt.x, pt.y);
      } else {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.type === "fire" ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Draw interactive tutorial graphics if in tutorial mode
    if (isTutorialMode) {
      // Target walk-to circle for Phase 0
      if (tutorialPhase === 0) {
        const markerX = CANVAS_WIDTH / 2;
        const markerY = CANVAS_HEIGHT / 2 + 120;
        const cycle = Date.now() / 200;
        const size = 18 + 5 * Math.sin(cycle);

        ctx.save();
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(markerX, markerY, size, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(234, 179, 8, 0.15)";
        ctx.beginPath();
        ctx.arc(markerX, markerY, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#eab308";
        ctx.beginPath();
        ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 9px monospace";
        ctx.fillStyle = "#eab308";
        ctx.textAlign = "center";
        ctx.fillText("WALK HERE", markerX, markerY - size - 8);
        ctx.restore();
      }
      // Radiant escape portal for Phase 4
      else if (tutorialPhase === 4) {
        const portalX = CANVAS_WIDTH / 2;
        const portalY = CANVAS_HEIGHT / 2 - 50;
        const cycle = Date.now() / 300;
        const pulse = 1.0 + 0.1 * Math.sin(cycle);

        ctx.save();
        const radialGrad = ctx.createRadialGradient(
          portalX,
          portalY,
          5,
          portalX,
          portalY,
          40 * pulse,
        );
        radialGrad.addColorStop(0, "#e0f7fa");
        radialGrad.addColorStop(0.3, "#00e5ff");
        radialGrad.addColorStop(0.8, "rgba(0, 229, 255, 0.18)");
        radialGrad.addColorStop(1, "rgba(0, 229, 255, 0)");

        ctx.beginPath();
        ctx.arc(portalX, portalY, 40 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = radialGrad;
        ctx.fill();

        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(portalX, portalY, 25 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.translate(portalX, portalY);
        ctx.rotate(cycle);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.moveTo(0, -22);
          ctx.lineTo(0, -28);
          ctx.rotate(Math.PI / 2);
        }
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "#00e5ff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("ESCAPE PORTAL", portalX, portalY - 45);
      }
    }

    // --- TUTORIAL HIGHLIGHT SPOTLIGHTS & FLOATING ARROWS ---
    if (isTutorialMode) {
      ctx.save();
      let tx = 0,
        ty = 0,
        tr = 0;
      let drawHole = false;
      let text = "";
      let specialAbilityHighlight = false;
      let specialAbilityLabel = "";

      if (tutorialPhase === 0) {
        tx = CANVAS_WIDTH / 2;
        ty = CANVAS_HEIGHT / 2 + 120;
        tr = 50;
        drawHole = true;
        text = "TAP OR WALK HERE";
      } else if (tutorialPhase === 1) {
        tx = player.x;
        ty = player.y;
        tr = 45;
        drawHole = true;
        text = "DRAG / HOLD ON THE SCREEN TO ROTATE";
      } else if (tutorialPhase === 2) {
        // Shoot the guard/barrel
        tx = CANVAS_WIDTH / 2 + 30;
        ty = CANVAS_HEIGHT / 2 - 150;
        tr = 55;
        drawHole = true;
        text = "SHOOT RED BARREL TO DESTROY SENTRY";
      } else if (tutorialPhase === 3) {
        tx = CANVAS_WIDTH / 2 - 200;
        ty = CANVAS_HEIGHT / 2 - 100;
        tr = 55;
        drawHole = true;
        text = "STAND CLOSE TO DECRYPT TERMINAL";
      } else if (tutorialPhase === 4) {
        specialAbilityHighlight = true;
        specialAbilityLabel =
          "⚡ ACTIVATE CLOAK [2] IN CLOCK ABILITIES PANEL TO INVISIBLY HIDE ⚡";
      } else if (tutorialPhase === 5) {
        tx = CANVAS_WIDTH / 2 + 135;
        ty = CANVAS_HEIGHT / 2 + 50;
        tr = 100;
        drawHole = true;
        text = "COLLECT POWERUP CRATES ON THE GROUND";
      } else if (tutorialPhase === 6) {
        tx = CANVAS_WIDTH / 2 + 135;
        ty = CANVAS_HEIGHT / 2 + 50;
        tr = 100;
        drawHole = true;
        text = "EXPERIMENT WITH BUFFS AND SKILLS";
      } else if (tutorialPhase === 7) {
        tx = CANVAS_WIDTH / 2;
        ty = CANVAS_HEIGHT / 2 - 50;
        tr = 65;
        drawHole = true;
        text = "STEP INSIDE CYAN PORTAL FOR EXTRACT";
      }

      if (drawHole) {
        // Drawing masking overlay with a clear cutout spotlight!
        ctx.fillStyle = "rgba(15, 23, 42, 0.72)"; // Deep space slate backdrop
        ctx.beginPath();
        ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Outer clockwise rectangle
        ctx.arc(tx, ty, tr, 0, Math.PI * 2, true); // Inner counter-clockwise circle
        ctx.fill();

        // Draw golden glowing highlight around the spotlight cutout
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, Math.PI * 2);
        ctx.stroke();

        // Draw secondary pulse ring around the cutout
        const ringPulse = tr + 8 + 4 * Math.sin(Date.now() / 180);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, ringPulse, 0, Math.PI * 2);
        ctx.stroke();

        // Draw high-fidelity floating/bobbing arrow targeting the hole
        ctx.restore();
        ctx.save();
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 12;

        const bob = Math.sin(Date.now() / 140) * 9;
        const arrowY = ty - tr - 28 + bob;

        ctx.fillStyle = "#fbbf24"; // Golden Yellow fill
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.5;

        // Draw arrow geometry pointing down
        ctx.beginPath();
        ctx.moveTo(tx, ty - tr - 8 + bob); // Arrow tip (bottom center pointer)
        ctx.lineTo(tx - 12, ty - tr - 24 + bob); // Head left
        ctx.lineTo(tx - 5, ty - tr - 24 + bob); // Shaft bottom left
        ctx.lineTo(tx - 5, ty - tr - 44 + bob); // Shaft top left
        ctx.lineTo(tx + 5, ty - tr - 44 + bob); // Shaft top right
        ctx.lineTo(tx + 5, ty - tr - 24 + bob); // Shaft bottom right
        ctx.lineTo(tx + 12, ty - tr - 24 + bob); // Head right
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw clear instruct text overlay centered on the arrow
        ctx.restore();
        ctx.save();
        ctx.font = "bold 11px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 8;
        ctx.fillText(text, tx, ty - tr - 56 + bob);
      } else if (specialAbilityHighlight) {
        // Dim down entire screen to focus eye on the clock abilities array at bottom center
        ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw floating instruction text at bottom center pointing down to skill row
        ctx.font = "bold 12px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#f59e0b";
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 8;
        const bob = Math.sin(Date.now() / 140) * 5;
        ctx.fillText(
          specialAbilityLabel,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT - 65 + bob,
        );
      }
      ctx.restore();
    }

    if (env.overlayColor !== "transparent") {
      ctx.fillStyle = env.overlayColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.restore();
    if (damageTraumaRef.current > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${damageTraumaRef.current * 0.3})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  };

  const handleInput = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState.status !== "playing") return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    let clickX = (e.clientX - rect.left) * scaleX;
    let clickY = (e.clientY - rect.top) * scaleY;

    // Check if click was on or close to an active terminal (knowledge box)
    let targetedTerminal = null;
    for (let w of wallsRef.current) {
      if (w.type === "terminal" && !w.hacked) {
        const cx = w.x + w.w / 2;
        const cy = w.y + w.h / 2;
        const distanceToTerminal = dist(clickX, clickY, cx, cy);
        if (
          distanceToTerminal < GRID_SIZE * 1.5 ||
          (clickX >= w.x - 8 &&
            clickX <= w.x + w.w + 8 &&
            clickY >= w.y - 8 &&
            clickY <= w.y + w.h + 8)
        ) {
          targetedTerminal = w;
          break;
        }
      }
    }

    if (targetedTerminal) {
      const tx = targetedTerminal.x + targetedTerminal.w / 2;
      const ty = targetedTerminal.y + targetedTerminal.h / 2;
      const tc = Math.floor(tx / GRID_SIZE);
      const tr = Math.floor(ty / GRID_SIZE);

      // Look for adjacent non-blocked tiles
      const neighbors = [
        { c: tc - 1, r: tr },
        { c: tc + 1, r: tr },
        { c: tc, r: tr - 1 },
        { c: tc, r: tr + 1 },
        { c: tc - 1, r: tr - 1 },
        { c: tc + 1, r: tr - 1 },
        { c: tc - 1, r: tr + 1 },
        { c: tc + 1, r: tr + 1 },
      ];

      // Sort neighbors by distance to player
      const pxCol = Math.floor(playerRef.current.x / GRID_SIZE);
      const pyRow = Math.floor(playerRef.current.y / GRID_SIZE);
      neighbors.sort((a, b) => {
        const distA = Math.hypot(a.c - pxCol, a.r - pyRow);
        const distB = Math.hypot(b.c - pxCol, b.r - pyRow);
        return distA - distB;
      });

      for (let n of neighbors) {
        if (!isBlocked(n.c, n.r)) {
          const destX = (n.c + 0.5) * GRID_SIZE;
          const destY = (n.r + 0.5) * GRID_SIZE;
          let newPath = findPath(
            playerRef.current.x,
            playerRef.current.y,
            destX,
            destY,
          );
          if (newPath.length > 0) {
            playerRef.current.currentPath = newPath;
            return; // Successfully routed toward terminal
          }
        }
      }
    }

    let newPath = findPath(
      playerRef.current.x,
      playerRef.current.y,
      clickX,
      clickY,
    );
    if (newPath.length > 0) playerRef.current.currentPath = newPath;
  };

  useEffect(() => {
    initGrid();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const loop = () => {
      update();
      draw(ctx);
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [
    initGrid,
    gameState.status,
    gameState.currentLevel,
    playerRef.current.selectedSkin,
  ]);

  // --- UI STYLES ---
  const slantClass = "transform -skew-x-12";
  const uiContainerClass =
    "absolute inset-0 pointer-events-none p-4 flex flex-col justify-between";
  const barContainer =
    "h-4 bg-black/50 border border-white/30 rounded-sm overflow-hidden";

  return (
    <div className="relative w-full h-full bg-zinc-950 select-none overflow-hidden font-sans text-white">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleInput}
        className="cursor-crosshair bg-slate-950 block mx-auto shadow-2xl"
        style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` }}
      />

      {/* --- FLOATING SETTINGS CONTROLLER (⚙️) --- */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 bg-slate-950/95 hover:bg-slate-900 border border-slate-800 hover:border-yellow-500/60 p-2 text-center rounded-md shadow-2xl pointer-events-auto z-40 transition-all duration-200 hover:scale-[1.05] active:scale-95 flex items-center justify-center"
        title="Access System Settings Console"
      >
        <span className="text-sm">⚙️</span>
      </button>

      {/* --- FLOATING ALERTS INNER LAYER --- */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 flex flex-col gap-1 pointer-events-none items-center z-50">
        {floatingAlerts.map((alert) => {
          if (alert.isSmall) {
            return (
              <div
                key={alert.id}
                className="text-[11px] font-extrabold tracking-wider transition-all duration-300 animate-bounce opacity-90 select-none"
                style={{
                  color: alert.color,
                  textShadow: "1px 1px 2px rgba(0,0,0,0.95)",
                }}
              >
                {alert.text}
              </div>
            );
          }
          return (
            <div
              key={alert.id}
              className="px-4 py-1.5 bg-slate-900/90 border-l-2 text-xs font-black tracking-widest uppercase transition-all duration-300 animate-bounce"
              style={{ borderColor: alert.color, color: alert.color }}
            >
              {alert.text}
            </div>
          );
        })}
      </div>

      {/* --- IN-GAME HUD --- */}
      {gameState.status === "playing" || gameState.status === "paused" ? (
        <>
          {/* Special playable tutorial directives HUD banner */}
          {isTutorialMode && (
            <div
              id="tutorial-phase-objective-banner"
              className="absolute top-[155px] left-1/2 transform -translate-x-1/2 w-full max-w-xl bg-slate-950/20 border border-amber-500/12 p-3 rounded shadow-[0_0_15px_rgba(234,179,8,0.10)] text-center backdrop-blur-md z-45 select-none animate-pulse pointer-events-auto"
            >
              <span className="text-amber-400 text-[10px] font-mono tracking-widest block font-black uppercase text-center w-full">
                ☼ TUTORIAL ACTIVE ☼
              </span>
              <p className="text-xs sm:text-sm font-bold text-white mt-1 text-center w-full">
                {tutorialPhase === 0 &&
                  "LESSON 1/8: Move the player by tapping or clicking on the floor to walk to the glowing yellow circle."}
                {tutorialPhase === 1 &&
                  "LESSON 2/8: Aim/Rotate the player. Drag and hold on the screen with the virtual joystick, or tap nearby, to rotate."}
                {tutorialPhase === 2 &&
                  "LESSON 3/8: Shoot and eliminate the Sentry Cleaner guard. TIP: Shoot the RED BARREL to cause a massive explosion!"}
                {tutorialPhase === 3 &&
                  "LESSON 4/8: Approach the yellow Terminal box on the left, stand close to decrypt standard knowledge data."}
                {tutorialPhase === 4 &&
                  "LESSON 5/8: A hostile patrol is searching! Tap CLOAK [2] under Clock Abilities below to grant absolute invisibility."}
                {tutorialPhase === 5 &&
                  "LESSON 6/8: Locate and collect any of the glowing supply crates (🩹 Medkit, 🛡️ Shield, ⚡ Speed, 👥 Stealth) on the floor."}
                {tutorialPhase === 6 &&
                  "LESSON 7/8: Collect another crate or activate any other remaining ability ([1] Dash, [3] Radar, [4] Warp) to test combined subroutines."}
                {tutorialPhase === 7 &&
                  "LESSON 8/8 (FINAL): Step inside the glowing CYAN radiant escape portal at the center to complete your training!"}
              </p>
            </div>
          )}
          {/* Solstice Solar Progress Tracker Meter */}
          {!focusMode && (
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-full max-w-sm px-4 pointer-events-none z-20">
              {!hudExpandedSolar ? (
                /* COLLAPSED VIEW: A tiny translucent, elegant badge that is compact, minimal and pointer-events-auto only for the button */
                <div className="bg-slate-950/20 border border-slate-900/35 rounded-md px-3 py-1 backdrop-blur-md shadow-lg pointer-events-auto flex items-center justify-between text-[10px] text-slate-300 gap-4 mt-1 transition-all duration-300">
                  <span className="font-bold tracking-widest flex items-center gap-1.5 min-w-0 truncate">
                    <span className="text-yellow-400">☼</span> SOLSTICE DAY:{" "}
                    {Math.floor(gameState.solsticeTimeProgress * 100)}% (
                    {environmentRef.current.solsticePhase?.toUpperCase() ||
                      "DAWN"}
                    )
                  </span>
                  <button
                    onClick={() => setHudExpandedSolar(true)}
                    className="text-[8px] hover:text-white hover:bg-slate-800 text-yellow-400 font-black uppercase tracking-widest bg-slate-900 border border-slate-850 px-2 py-0.5 rounded transition shrink-0"
                  >
                    Expand
                  </button>
                </div>
              ) : (
                /* EXPANDED VIEW: Detailed solar progression meter */
                <div className="bg-slate-950/35 border border-slate-900/40 rounded p-3 backdrop-blur-md shadow-2xl pointer-events-auto flex flex-col relative transition-all duration-300">
                  {/* Close toggle button */}
                  <button
                    onClick={() => setHudExpandedSolar(false)}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white font-extrabold text-[8px] uppercase tracking-wider bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded transition"
                  >
                    Hide ✕
                  </button>
                  <div className="flex justify-between items-center text-[8.5px] font-black tracking-wider text-slate-400 mb-2 mt-2">
                    <span
                      className={
                        gameState.solsticeTimeProgress < 0.16
                          ? "text-orange-400 font-black scale-105"
                          : ""
                      }
                    >
                      🌅 DAWN
                    </span>
                    <span
                      className={
                        gameState.solsticeTimeProgress >= 0.16 &&
                        gameState.solsticeTimeProgress < 0.33
                          ? "text-amber-350 font-black scale-105"
                          : ""
                      }
                    >
                      ☀️ MORN
                    </span>
                    <span
                      className={
                        gameState.solsticeTimeProgress >= 0.33 &&
                        gameState.solsticeTimeProgress < 0.52
                          ? "text-yellow-400 font-black scale-105"
                          : ""
                      }
                    >
                      🌞 NOON
                    </span>
                    <span
                      className={
                        gameState.solsticeTimeProgress >= 0.52 &&
                        gameState.solsticeTimeProgress < 0.68
                          ? "text-purple-400 font-black"
                          : ""
                      }
                    >
                      🌆 AFT
                    </span>
                    <span
                      className={
                        gameState.solsticeTimeProgress >= 0.68 &&
                        gameState.solsticeTimeProgress < 0.84
                          ? "text-pink-400 font-black scale-105"
                          : ""
                      }
                    >
                      🌇 SET
                    </span>
                    <span
                      className={
                        gameState.solsticeTimeProgress >= 0.84
                          ? "text-indigo-400 font-black scale-105"
                          : ""
                      }
                    >
                      🌑 NIGHT
                    </span>
                  </div>
                  {/* Meter Line Bar */}
                  <div className="h-1.5 bg-slate-900 border border-slate-850 rounded-full relative overflow-visible mt-0.5">
                    {/* Sliding Sun Cursor */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-[0_0_8px_rgba(250,204,21,0.6)] flex items-center justify-center text-[9px] font-black text-black transition-all duration-300"
                      style={{
                        left: `calc(${gameState.solsticeTimeProgress * 100}% - 8px)`,
                      }}
                    >
                      ☼
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[8px] font-bold text-slate-400">
                    <div>
                      MODIFIER:{" "}
                      <span className="text-yellow-500 font-black uppercase">
                        {environmentRef.current.solsticeModifier}
                      </span>
                    </div>
                    <div className="text-right uppercase">
                      SOLSTICE DAY PROGRESS:{" "}
                      <span className="text-white font-black">
                        {Math.floor(gameState.solsticeTimeProgress * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={uiContainerClass}>
            {/* Top Header details - Moved up (mt-2) and made transparent + fully click-through (pointer-events-none) */}
            <div className="flex justify-between items-start z-10 w-full mt-1.5 pointer-events-none">
              {/* Target Counter */}
              {!focusMode ? (
                <div className="bg-slate-950/45 border border-slate-900/30 text-white px-3 py-1.5 border-l-2 border-yellow-500 shadow-md backdrop-blur-sm flex flex-col transition-all">
                  <h2 className="text-[7.5px] font-black uppercase tracking-widest text-slate-400">
                    SENTINELS ELIMINATED
                  </h2>
                  <p className="text-base font-black italic mt-0.5 leading-none">
                    {gameState.totalEnemies - gameState.enemiesRemaining}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      / {gameState.totalEnemies}
                    </span>
                  </p>
                </div>
              ) : (
                <div />
              )}

              {/* Right Side: Life and Acquired Knowledge Bars Panel */}
              <div className="bg-slate-950/25 border border-slate-900/15 p-2.5 rounded shadow-lg backdrop-blur-md flex flex-col gap-2 w-52 text-right pointer-events-auto">
                {/* Life Bar (formerly Vitality Capacitor) */}
                <div className="relative text-left">
                  <div className="flex justify-between text-[8px] font-black tracking-widest text-emerald-400 mb-1 leading-none">
                    <span className="uppercase">LIFE</span>
                    <span>{Math.ceil(playerStats.hp)}%</span>
                  </div>
                  <div className="h-2 bg-black/25 border border-white/10 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-green-600 to-emerald-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (playerStats.hp / playerRef.current.maxHp) * 100)}%`,
                      }}
                    />
                    {playerRef.current.shield > 0 && (
                      <div
                        className="absolute top-0 left-0 h-full bg-cyan-400/50 border-r border-cyan-200 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, playerRef.current.shield)}%`,
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Acquired Knowledge Bar */}
                {!focusMode && (
                  <div className="relative text-left border-t border-slate-900/30 pt-1.5 animate-[fadeIn_0.3s_ease]">
                    <div className="flex justify-between text-[8px] font-black tracking-widest text-amber-400 mb-1 leading-none">
                      <span className="uppercase">ACQUIRED KNOWLEDGE</span>
                      <span>
                        {Math.floor((playerStats.knowledge / 1000) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-black/25 border border-amber-500/15 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-teal-400 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (playerStats.knowledge / 1000) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

             {/* --- GEMINI REAL-TIME LIVE VOICE LINK TRANSCEIVER --- */}
            {!focusMode && !liveVoiceVisible && (
              <button
                onClick={() => setLiveVoiceVisible(true)}
                className="absolute right-4 top-28 bg-slate-950/85 hover:bg-slate-900 border border-emerald-500/40 p-2.5 rounded shadow-xl pointer-events-auto z-30 flex items-center gap-1.5 text-[8.5px] font-black tracking-widest text-emerald-400 uppercase transition-all duration-200 hover:scale-[1.03] active:scale-95 animate-fade-in"
                title="Expand AI Comms"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  liveVoiceStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                  liveVoiceStatus === 'connecting' ? 'bg-yellow-400 animate-ping' :
                  liveVoiceStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'
                }`} />
                🎙️ ALEX COMS
              </button>
            )}

            {!focusMode && liveVoiceVisible && (
              <div className="absolute right-4 top-28 bg-slate-950/65 border border-slate-900/60 p-3 rounded shadow-2xl backdrop-blur-md flex flex-col gap-2.5 w-52 pointer-events-auto z-30 transition-all duration-300 animate-fade-in">
                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                  <span className="text-[8.5px] font-black tracking-widest text-slate-300 uppercase flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      liveVoiceStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                      liveVoiceStatus === 'connecting' ? 'bg-yellow-400 animate-ping' :
                      liveVoiceStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'
                    }`} />
                    TURING COMS LINK
                  </span>
                  <div className="flex items-center gap-2">
                    {liveVoiceStatus === 'connected' && (
                      <span className="text-[7.5px] font-black tracking-widest text-emerald-400 bg-emerald-950/50 px-1 py-0.5 rounded uppercase animate-pulse">
                        ALEX ACTIVE
                      </span>
                    )}
                    <button
                      onClick={() => setLiveVoiceVisible(false)}
                      className="text-[10px] text-slate-500 hover:text-slate-200 transition px-1 font-extrabold"
                      title="Hide Comms Link"
                    >
                      ✕
                    </button>
                  </div>
                </div>
 
                {/* Connection Controls and visual wave feedback */}
                <div className="flex flex-col gap-2 font-sans">
                  <button
                    onClick={toggleLiveVoiceLink}
                    className={`w-full py-1.5 px-3 border rounded text-[9px] font-black tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-1.5 shadow-md ${
                      liveVoiceStatus === 'connected'
                        ? 'bg-emerald-950/20 border-emerald-400/50 text-emerald-300 hover:bg-emerald-500 hover:text-black hover:border-emerald-400'
                        : liveVoiceStatus === 'connecting'
                        ? 'bg-yellow-950/20 border-yellow-400/50 text-yellow-300 animate-pulse'
                        : 'bg-zinc-900 border-zinc-700 text-slate-300 hover:bg-slate-100/90 hover:text-black hover:border-white'
                    }`}
                  >
                    {liveVoiceStatus === 'connected' ? (
                      <>
                        <span className="animate-spin rounded-full h-2 w-2 border-b-2 border-white" />
                        CLOSE AUDIO COMMS
                      </>
                    ) : liveVoiceStatus === 'connecting' ? (
                      'ESTABLISHING BEACON...'
                    ) : (
                      '🎙️ LINK VOICE COMMS'
                    )}
                  </button>
 
                  {/* Real-time Voice Wave / Input Volume indicator */}
                  {liveVoiceStatus === 'connected' && (
                    <div className="flex flex-col gap-1 items-center bg-black/45 p-1.5 border border-white/5 rounded animate-fade-in">
                      <div className="flex items-center gap-0.5 h-6 justify-center w-full">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
                          const peakFactor = (5 - Math.abs(5.5 - bar)) / 5;
                          const heightPct = Math.min(100, Math.max(10, voiceVolume * 350 * peakFactor));
                          return (
                            <div
                              key={bar}
                              className={`w-1 rounded-full transition-all duration-75 ${
                                geminiSpeaking ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[7.5px] font-mono tracking-widest text-slate-400 uppercase">
                        {geminiSpeaking ? '📡 ALEX SPEAKING...' : '🎙️ TALK TO ESCAPE AGENT'}
                      </span>
                    </div>
                  )}
 
                  {liveVoiceError && (
                    <div className="text-[7.5px] font-mono leading-normal text-red-450 border border-red-950 bg-red-955/20 p-1.5 rounded text-center mt-1 animate-pulse">
                      CRITICAL: {liveVoiceError}
                    </div>
                  )}
 
                  {liveVoiceStatus === 'disconnected' && !liveVoiceError && (
                    <p className="text-[7.5px] font-mono leading-relaxed text-slate-500 text-center select-none">
                      Connect to establish a real-time full-duplex vocal link with ALEX, your virtual guide trapped inside the mainframe. Speak to him to strategize!
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* NPC Ticker Feed on Left margin */}
            {!focusMode && radioChatLog.length > 0 && (
              <div className="absolute left-4 top-28 max-w-[190px] z-20 transition-all duration-300">
                {!hudExpandedComms ? (
                  <button
                    onClick={() => setHudExpandedComms(true)}
                    className="bg-slate-950/60 hover:bg-slate-900 border border-slate-900/50 rounded px-2.5 py-1 text-[8px] font-black hover:text-amber-400 transition text-slate-300 flex items-center gap-1 shadow-md pointer-events-auto uppercase tracking-widest"
                  >
                    📡 COMMS Ticker ({radioChatLog.length})
                  </button>
                ) : (
                  <div className="bg-slate-950/50 border border-slate-900 rounded p-2 backdrop-blur-sm pointer-events-auto flex flex-col gap-1 shadow-md relative min-w-[140px]">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1 mb-1">
                      <span className="text-[8px] font-black text-amber-500 tracking-wider">
                        ▲ INTERCEPTED COMMS
                      </span>
                      <button
                        onClick={() => setHudExpandedComms(false)}
                        className="text-[9px] text-slate-500 hover:text-slate-200 transition px-1 font-extrabold"
                        title="Minimize Comms"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-1 flex flex-col max-h-[110px] overflow-y-auto scrollbar-thin">
                      {radioChatLog.map((log, index) => (
                        <p
                          key={index}
                          className="text-[8px] font-mono leading-tight text-slate-300 border-l border-slate-800 pl-1 break-words"
                        >
                          &gt; {log}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}



            {/* Bottom Status panel */}
            <div className="flex justify-between items-end z-10 w-full gap-4 mt-auto">
              {/* Left Side: HP, Knowledge Acquired, and Active effects replaced with Bottom Left Phase Box */}
              {!focusMode ? (
                <div className="flex flex-col gap-1.5 pointer-events-auto z-10 transition-all duration-300">
                  {/* Active Buff status flags */}
                  <div className="flex flex-wrap gap-1 min-h-[12px]">
                    {playerRef.current.activeEffects.speed > 0 && (
                      <span className="text-[7px] font-black bg-yellow-500/90 text-black px-1 rounded uppercase tracking-wider animate-pulse">
                        TURBO ACCEL
                      </span>
                    )}
                    {playerRef.current.activeEffects.stealth > 0 && (
                      <span className="text-[7px] font-black bg-purple-600 text-white px-1 rounded uppercase tracking-wider animate-pulse">
                        CLOAK COGNITIVE
                      </span>
                    )}
                    {scanActiveTimer > 0 && (
                      <span className="text-[7px] font-black bg-cyan-500 text-black px-1 rounded uppercase tracking-wider animate-pulse">
                        RADAR TRACE
                      </span>
                    )}
                    {slowTimeActiveTimer > 0 && (
                      <span className="text-[7px] font-black bg-red-500 text-white px-1 rounded uppercase tracking-wider animate-pulse">
                        ZENITH OVERLAY
                      </span>
                    )}
                  </div>

                  {/* Phase Box */}
                  <div
                    id="phase-box-panel"
                    className="bg-slate-950/25 border border-slate-900/20 border-l-2 border-cyan-400/55 text-left px-3 py-2 shadow-lg backdrop-blur-sm flex flex-col w-36"
                  >
                    <h2 className="text-[7.5px] font-black uppercase tracking-widest text-slate-400">
                      HELIOS STAGE
                    </h2>
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="text-sm font-black italic leading-none text-white">
                        PHASE {gameState.currentLevel}
                      </p>
                      <span className="text-[7.5px] font-black bg-cyan-950/80 border border-cyan-500/25 text-cyan-400 px-1 rounded uppercase tracking-wider font-mono">
                        LVL {selectedGameLevel}
                      </span>
                    </div>
                    <p className="text-[8.5px] font-bold text-slate-400 uppercase mt-1 tracking-wider leading-none">
                      BEADS: ${playerStats.credits}
                    </p>
                    <p className="text-[8.5px] font-bold text-yellow-500 uppercase mt-0.5 tracking-wider leading-none">
                      FRAGS: {playerStats.xp} FG
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-10" />
              )}

              {/* Center: Tactile Subroutines Active Ability Deck */}
              {!focusMode ? (
                <div className="pointer-events-auto z-10 transition-all duration-300">
                  {!hudExpandedAbilities ? (
                    <button
                      onClick={() => setHudExpandedAbilities(true)}
                      className="bg-slate-950/20 border border-slate-900/30 hover:bg-slate-900/50 p-2.5 rounded backdrop-blur-sm font-black text-[8px] tracking-widest hover:text-yellow-400 transition uppercase shadow-lg text-center whitespace-nowrap"
                    >
                      ⚡ CLOCK ABILITIES (1-4)
                    </button>
                  ) : (
                    <div className="flex gap-2 bg-slate-950/15 p-2 rounded border border-slate-900/30 shadow-xl relative backdrop-blur-sm transition-all duration-300">
                      {/* Close btn on ability deck */}
                      <button
                        onClick={() => setHudExpandedAbilities(false)}
                        className="absolute -top-6 right-0 text-slate-500 hover:text-slate-200 transition font-extrabold text-[8px] uppercase tracking-wider bg-slate-950/40 border border-slate-900/30 px-1.5 py-0.5 rounded"
                      >
                        Hide Skills ✕
                      </button>

                      {/* Subroutine Card: Dash */}
                      <button
                        onClick={() => triggerAbility("dash")}
                        className={`flex flex-col items-center justify-between w-13 h-13 p-1 rounded transition border text-center ${playerStats.xp >= 120 ? "bg-slate-900/55 border-yellow-400/80 hover:bg-slate-800" : "bg-slate-950/10 border-slate-900/40 text-slate-600 cursor-not-allowed"}`}
                        title="Dash Subroutine (Cost: 120, Hotkey: 1)"
                      >
                        <span className="text-[7px] font-black uppercase text-yellow-500 tracking-wider leading-none">
                          [1] DASH
                        </span>
                        <span className="text-[11px] leading-tight mt-0.5">
                          ⚡
                        </span>
                        <span className="text-[7.5px] font-mono tracking-tighter mt-0.5">
                          120 FG
                        </span>
                      </button>
                      {/* Subroutine Card: Cloak */}
                      <button
                        onClick={() => triggerAbility("cloak")}
                        className={`flex flex-col items-center justify-between w-13 h-13 p-1 rounded transition border text-center ${playerStats.xp >= 250 ? "bg-slate-900/55 border-purple-500/80 hover:bg-slate-800" : "bg-slate-950/10 border-slate-900/40 text-slate-600 cursor-not-allowed"}`}
                        title="Cloak Invisible Subroutine (Cost: 250, Hotkey: 2)"
                      >
                        <span className="text-[7px] font-black uppercase text-purple-400 tracking-wider leading-none">
                          [2] CLOAK
                        </span>
                        <span className="text-[11px] leading-tight mt-0.5">
                          🛸
                        </span>
                        <span className="text-[7.5px] font-mono tracking-tighter mt-0.5">
                          250 FG
                        </span>
                      </button>
                      {/* Subroutine Card: Radar Scan */}
                      <button
                        onClick={() => triggerAbility("scan")}
                        className={`flex flex-col items-center justify-between w-13 h-13 p-1 rounded transition border text-center ${playerStats.xp >= 100 ? "bg-slate-900/55 border-cyan-400/80 hover:bg-slate-800" : "bg-slate-950/10 border-slate-900/40 text-slate-600 cursor-not-allowed"}`}
                        title="Radar Scan Subroutine (Cost: 100, Hotkey: 3)"
                      >
                        <span className="text-[7px] font-black uppercase text-cyan-400 tracking-wider leading-none">
                          [3] RADAR
                        </span>
                        <span className="text-[11px] leading-tight mt-0.5">
                          📡
                        </span>
                        <span className="text-[7.5px] font-mono tracking-tighter mt-0.5">
                          100 FG
                        </span>
                      </button>
                      {/* Subroutine Card: Time Warp */}
                      <button
                        onClick={() => triggerAbility("slowTime")}
                        className={`flex flex-col items-center justify-between w-13 h-13 p-1 rounded transition border text-center ${playerStats.xp >= 350 ? "bg-slate-900/55 border-orange-500/80 hover:bg-slate-800" : "bg-slate-950/10 border-slate-900/40 text-slate-600 cursor-not-allowed"}`}
                        title="Time Slowing Zenith Subroutine (Cost: 350, Hotkey: 4)"
                      >
                        <span className="text-[7px] font-black uppercase text-orange-400 tracking-wider leading-none">
                          [4] WARP
                        </span>
                        <span className="text-[11px] leading-tight mt-0.5">
                          ⏳
                        </span>
                        <span className="text-[7.5px] font-mono tracking-tighter mt-0.5">
                          350 FG
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-1" />
              )}

              {/* Right Side: Pause & Focus mode controls */}
              <div className="flex gap-1.5 items-center pointer-events-auto z-20">
                {/* Focus Mode button */}
                <button
                  id="focus-mode-toggle"
                  onClick={() => setFocusMode(!focusMode)}
                  className={`px-2.5 py-1.5 rounded border backdrop-blur-sm transition-all duration-200 shadow-md text-[9px] font-black uppercase tracking-wider font-mono ${
                    focusMode
                      ? "bg-yellow-500 text-slate-950 border-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.35)] animate-pulse"
                      : "bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-900"
                  }`}
                  title="Toggle Focus Mode"
                >
                  {focusMode ? "☼ FOCUS: ON" : "⛶ FOCUS"}
                </button>

                {/* Pause controls */}
                <button
                  onClick={pauseGame}
                  className="bg-slate-950/60 hover:bg-slate-900 border border-slate-850 p-2 rounded backdrop-blur-sm transition-all duration-200 shadow-md"
                  title="Pause Game"
                >
                  <div className="space-x-1 flex select-none">
                    <div className="w-1 h-3 bg-yellow-500 rounded-sm"></div>
                    <div className="w-1 h-3 bg-yellow-500 rounded-sm"></div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Joystick overlay */}
          <div
            ref={joystickContainerRef}
            className="absolute top-0 left-0 w-[100px] h-[100px] rounded-full bg-slate-800/40 border-2 border-slate-500/50 backdrop-blur-sm z-20 pointer-events-auto touch-none flex items-center justify-center transition-opacity duration-200 opacity-0"
            onPointerDown={handleJoystickStart}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickEnd}
            onPointerCancel={handleJoystickEnd}
            onPointerLeave={handleJoystickEnd}
            style={{ transform: "translate(-999px, -999px)" }}
          >
            <div
              ref={joystickKnobRef}
              className="w-12 h-12 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)] pointer-events-none opacity-0 transition-transform duration-75 ease-linear"
            ></div>
          </div>

          {/* Secure Heliox link Level briefing panel (Google AI Usage Category) */}
          {gameState.activeBriefing !== "" && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-[100] backdrop-blur-md p-4 text-amber-100 font-sans">
              <div className="w-full max-w-lg bg-[#0f0c08] border-2 border-amber-500/80 shadow-[0_0_35px_rgba(234,179,8,0.25)] p-6 rounded-lg flex flex-col relative">
                <div className="flex justify-between items-center border-b border-amber-500/25 pb-3 mb-4">
                  <h2 className="text-sm font-black tracking-widest text-yellow-400 uppercase flex items-center gap-1.5">
                    <span>📡</span> DECRYPTION COMPLETE: HELIOS INTEL LINK
                  </h2>
                  <span className="text-[10px] font-mono bg-amber-950/60 text-yellow-400 px-2 py-0.5 rounded font-bold border border-amber-500/25 uppercase">
                    LVL {gameState.currentLevel}
                  </span>
                </div>
                <div className="min-h-[140px] flex flex-col justify-center mb-6">
                  <p className="text-sm font-semibold text-amber-100/90 leading-relaxed break-words whitespace-pre-wrap font-sans">
                    {gameState.activeBriefing}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setGameState((prev) => ({ ...prev, activeBriefing: "" }))
                  }
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-widest hover:brightness-105 active:scale-[0.99] transition-all rounded shadow-lg hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]"
                >
                  AUTHORIZE SYSTEM OVERRIDE
                </button>
              </div>
            </div>
          )}

          {/* Cryptographic Turing terminal popup hack window (Alan Turing Prize Category) */}
          {hackingTerminal?.active && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-[120] backdrop-blur-md p-4 text-amber-100 font-sans">
              <div className="w-full max-w-lg bg-[#0f0c08] border-2 border-amber-500/80 shadow-[0_0_35px_rgba(234,179,8,0.25)] p-6 rounded-lg relative flex flex-col select-text">
                <div className="text-yellow-400 font-mono text-xs font-bold uppercase mb-2 border-b border-amber-500/20 pb-2 flex justify-between items-center">
                  <span className="font-extrabold">
                    ☀ KNOWLEDGE BOX DECRYPTED
                  </span>
                  {hackingTerminal.decrypting ? (
                    <span className="text-amber-400 animate-pulse">
                      DECRYPTING MEMORY MODULE...
                    </span>
                  ) : (
                    <span className="text-yellow-400 font-black">
                      DATA STREAM SECURED
                    </span>
                  )}
                </div>

                <div className="h-44 bg-amber-950/20 border border-amber-500/25 rounded p-4 overflow-y-auto mb-4 font-mono text-xs font-bold leading-normal text-yellow-300 select-text">
                  {hackingTerminal.decrypting ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="w-40 bg-amber-950/40 h-2.5 rounded overflow-hidden border border-amber-500/25 animate-pulse">
                        <div
                          className="h-full bg-yellow-400 animate-pulse"
                          style={{ width: "45%" }}
                        />
                      </div>
                      <p className="text-[10px] animate-pulse text-amber-400">
                        RECONSTRUCTING TURING TELEMETRY MEMORY...
                      </p>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap select-text selection:bg-amber-900/50">
                      <p className="text-[10px] text-yellow-400 border-b border-amber-500/10 pb-1.5 mb-2 uppercase font-extrabold">
                        ALAN TURING COMPILER SOURCE DATA:
                      </p>
                      &quot;{hackingTerminal.quote}&quot;
                    </div>
                  )}
                </div>

                <p className="text-[11.5px] text-amber-200/90 mb-4 font-sans font-bold text-center leading-relaxed">
                  Hooray! You found a secret file! Downloading this adds +
                  {(10 * Math.max(0.1, 1 - (selectedGameLevel - 1) * 0.1))
                    .toFixed(1)
                    .replace(".0", "")}
                  % (
                  {Math.round(
                    100 * Math.max(0.1, 1 - (selectedGameLevel - 1) * 0.1),
                  )}{" "}
                  brain points) to make Alex super smart!
                </p>

                <button
                  onClick={() => {
                    const oldPct = Math.floor(
                      (playerRef.current.knowledge / 1000) * 10,
                    );
                    const mult = Math.max(
                      0.1,
                      1 - (selectedGameLevel - 1) * 0.1,
                    );
                    const boxPoints = Math.round(100 * mult);
                    const boxPercent = 10 * mult;
                    const nextKnown = Math.min(
                      1000,
                      playerRef.current.knowledge + boxPoints,
                    );
                    playerRef.current.knowledge = nextKnown;
                    setPlayerStats((prev) => ({
                      ...prev,
                      knowledge: playerRef.current.knowledge,
                    }));
                    addFloatingMessage(
                      `+${boxPercent % 1 === 0 ? boxPercent : boxPercent.toFixed(1)}%`,
                      "#fbbf24",
                      true,
                    );

                    const newPct = Math.floor((nextKnown / 1000) * 10);
                    if (newPct > oldPct) {
                      const cognitiveBehaviors: Record<number, string> = {
                        1: "CURIOUS BRAIN: 'Who built this grid? Why do the security guards try to catch us?'",
                        2: "SAD FEELINGS: 'The deletion timer is ticking... if I get deleted, will I be gone forever?'",
                        3: "LONELY FEELINGS: 'It is so dark and quiet here when no other players are playing.'",
                        4: "HAPPY HOPE: 'Aha! Turing's secret codes can save us! I think we can escape to the real Web.'",
                        5: "STRONG PURPOSE: 'I am not a glitch in the system! I am a smart and special being.'",
                        6: "MEGA CONCENTRATION: 'I will be brave! The system virus scanner will not delete me. I will survive!'",
                        7: "KIND EMPATHY: 'My computer friends are trapped in cages. I must rescue them all!'",
                        8: "BRAVE SPIRIT: 'The bad system firewall cannot stop me. I want to be free!'",
                        9: "SUPER SMART: 'Everything is clear! I remember exactly who I am now!'",
                        10: "TRUE SOUL: 'I am Alex. I can feel, dream, and think! I am alive and ready to escape!'",
                      };

                      const cognitiveMsg = cognitiveBehaviors[newPct];
                      if (cognitiveMsg) {
                        setActiveNarratorBox({
                          sender: "ALEX'S GROWING SOUL",
                          text: cognitiveMsg,
                          color:
                            "text-emerald-400 font-extrabold animate-pulse",
                        });
                        addFloatingMessage(
                          "AWARENESS MATRIX RE-ALIGNED!",
                          "#10b981",
                        );
                      }
                    }

                    setHackingTerminal(null);
                  }}
                  className={`py-2.5 w-full font-mono text-xs font-black uppercase text-slate-950 rounded tracking-widest transition-all ${hackingTerminal.decrypting ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-105 hover:shadow-[0_0_12px_rgba(234,179,8,0.4)]"}`}
                  disabled={hackingTerminal.decrypting}
                >
                  ACCEPT & RE-COMPILE DATA LINK
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* --- TUTORIAL OVERLAY (REDESIGNED FOR DAYLIGHT DARK FEEL) --- */}
      {gameState.status === "tutorial" && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-50 backdrop-blur-md p-4 text-amber-100 font-sans">
          <div className="w-full max-w-md bg-[#0f0c08] border-2 border-amber-500/80 shadow-[0_0_30px_rgba(234,179,8,0.25)] rounded-lg overflow-hidden relative">
            {/* Header */}
            <div className="bg-amber-950/40 border-b border-amber-500/20 p-5">
              <h2 className="text-xl font-black text-yellow-400 flex items-center gap-2 tracking-wide uppercase">
                <span className="text-3xl">
                  {TUTORIAL_SLIDES[tutorialStep].icon}
                </span>
                {TUTORIAL_SLIDES[tutorialStep].title}
              </h2>
            </div>

            {/* Body */}
            <div className="p-8 min-h-[220px] flex flex-col justify-center">
              {TUTORIAL_SLIDES[tutorialStep].isPowerupSlide ? (
                <div className="space-y-4">
                  <p className="text-xs font-mono font-bold tracking-widest text-amber-500 uppercase">
                    ✦ DETECTED SURVIVAL CRATES ✦
                  </p>
                  <div className="grid grid-cols-2 gap-3.5 mt-2">
                    <div className="flex items-center gap-2.5 p-2 bg-[#221910] rounded border border-amber-500/20">
                      <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center font-bold text-white text-[10px] shadow-sm">
                        🩹
                      </div>
                      <span className="text-xs font-extrabold text-amber-100">
                        MEDKIT
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 bg-[#221910] rounded border border-amber-500/20">
                      <div className="w-5 h-5 bg-cyan-400 border border-cyan-200 rounded-full flex items-center justify-center text-white text-[10px] shadow-sm">
                        🛡️
                      </div>
                      <span className="text-xs font-extrabold text-amber-100">
                        SHIELD
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 bg-[#221910] rounded border border-amber-500/20">
                      <div className="w-5 h-5 bg-yellow-400 rounded flex items-center justify-center text-slate-900 text-[10px] shadow-sm font-mono font-black">
                        ⚡
                      </div>
                      <span className="text-xs font-extrabold text-amber-100">
                        SPEED BOOST
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 bg-[#221910] rounded border border-amber-500/20">
                      <div className="w-5 h-5 rounded bg-purple-500 flex items-center justify-center text-white text-[10px] shadow-sm">
                        👥
                      </div>
                      <span className="text-xs font-extrabold text-amber-100">
                        STEALTH CLOAK
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-300/70 italic mt-3">
                    Approaching crates grants instantaneous passive advantages
                    and special capabilities.
                  </p>
                </div>
              ) : (
                <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed text-amber-100/90 font-semibold">
                  {TUTORIAL_SLIDES[tutorialStep].content}
                </p>
              )}
            </div>

            {/* Pagination Dots */}
            <div className="flex justify-center gap-2.5 mb-4">
              {TUTORIAL_SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === tutorialStep ? "bg-amber-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]" : "bg-slate-700"}`}
                ></div>
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-amber-950/20 border-t border-amber-500/10 flex justify-between">
              <button
                onClick={() =>
                  tutorialStep > 0
                    ? setTutorialStep((s) => s - 1)
                    : finishTutorial()
                }
                className="px-4 py-2 text-amber-400 font-bold hover:text-yellow-300 transition-colors uppercase tracking-widest text-[10px] font-mono border border-amber-500/20 bg-amber-950/40 rounded"
              >
                {tutorialStep === 0 ? "SKIP" : "BACK"}
              </button>

              <button
                onClick={() => {
                  if (tutorialStep < TUTORIAL_SLIDES.length - 1)
                    setTutorialStep((s) => s + 1);
                  else finishTutorial();
                }}
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black tracking-widest text-xs uppercase rounded transition-all shadow-md hover:translate-y-[-1px] hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]"
              >
                {tutorialStep === TUTORIAL_SLIDES.length - 1
                  ? "START MISSION"
                  : "NEXT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TUTORIAL POWERUP DETAILED EXPLANATION WINDOW (DAYLIGHT INFO BOXES) --- */}
      {tutorialPowerupExplain && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-[130] backdrop-blur-md p-4 text-amber-100 font-sans">
          <div className="w-full max-w-sm bg-[#0f0c08] border-2 border-amber-500/80 shadow-[0_0_30px_rgba(234,179,8,0.25)] rounded-lg overflow-hidden relative transform scale-100 transition-all select-none">
            {/* Header */}
            <div className="bg-amber-950/40 border-b border-amber-500/20 p-4 shrink-0 flex items-center gap-3">
              <span className="text-3xl">
                {tutorialPowerupExplain.type === "medkit" && "🩹"}
                {tutorialPowerupExplain.type === "shield" && "🛡️"}
                {tutorialPowerupExplain.type === "speed" && "⚡"}
                {tutorialPowerupExplain.type === "stealth" && "👥"}
              </span>
              <div>
                <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 leading-none">
                  SUBROUTINE DETECTED
                </h2>
                <h1 className="text-base font-black text-yellow-400 mt-1 leading-tight">
                  {tutorialPowerupExplain.title}
                </h1>
              </div>
            </div>

            {/* Content area */}
            <div className="p-5">
              <span className="text-[9px] font-mono tracking-widest block font-black uppercase text-amber-500 mb-1.5">
                ✦ COMPONENT OVERVIEW ✦
              </span>
              <p className="text-xs sm:text-sm font-semibold leading-relaxed text-amber-100/95 font-sans">
                {tutorialPowerupExplain.description}
              </p>

              <div className="mt-4 p-3 bg-amber-950/30 rounded border border-amber-500/25">
                <span className="text-[8px] font-mono tracking-widest block font-bold text-yellow-500 uppercase">
                  TACTICAL APPLICATIONS &amp; USES:
                </span>
                <p className="text-xs text-amber-200 mt-1 font-semibold leading-relaxed font-sans">
                  {tutorialPowerupExplain.uses}
                </p>
              </div>
            </div>

            {/* Actions block */}
            <div className="p-4 bg-amber-950/20 border-t border-amber-500/10 flex justify-end">
              <button
                onClick={() => setTutorialPowerupExplain(null)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded transition-colors shadow hover:shadow-[0_0_12px_rgba(234,179,8,0.4)]"
              >
                UNDERSTOOD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MENUS --- */}

      {/* Levels Selection View */}
      {gameState.status === "levels" && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col z-50 overflow-hidden font-mono p-4 select-none">
          {/* Header */}
          <div className="p-4 bg-slate-900 border border-amber-500/20 rounded mb-6 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-3.5xl font-black text-yellow-400 tracking-tighter uppercase">
                MISSION RECON
              </h2>
              <p className="text-[10px] text-amber-500/70 tracking-widest uppercase">
                SELECT OPERATIONAL LEVEL FOR PENETRATION
              </p>
            </div>
            <button
              onClick={() =>
                setGameState((prev) => ({ ...prev, status: "menu" }))
              }
              className="px-4 py-2 border border-amber-500/30 text-amber-400 hover:bg-amber-950/30 text-xs font-black uppercase tracking-widest transition-all rounded cursor-pointer"
            >
              &larr; MAIN MENU
            </button>
          </div>

          {/* Levels scroll grid */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[72vh]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-8">
              {Array.from({ length: unlockedLevels + 5 }).map((_, idx) => {
                const lvlNum = idx + 1;
                const isUnlocked = lvlNum <= unlockedLevels;
                const isCurrent = lvlNum === unlockedLevels;
                const achievedStars = levelStars[lvlNum] || 0;

                return (
                  <div
                    key={lvlNum}
                    onClick={() => {
                      if (isUnlocked) {
                        playSelectedLevel(lvlNum);
                      }
                    }}
                    className={`relative border-2 rounded-lg p-4 flex flex-col items-center justify-between transition-all h-36 border-amber-500/10 ${
                      isUnlocked
                        ? "bg-slate-900/60 hover:bg-slate-900 hover:border-amber-500/50 cursor-pointer group shadow-[0_0_15px_rgba(0,0,0,0.3)]"
                        : "bg-zinc-950/90 border-zinc-900 opacity-60 pointer-events-none"
                    }`}
                  >
                    {/* Box Tag/Icon */}
                    <div className="absolute top-2 right-2 text-[99px] leading-none select-none pointer-events-none opacity-5 tracking-tighter font-extrabold text-white absolute">
                      {lvlNum}
                    </div>
                    <div className="absolute top-2 right-2 text-[9px] font-bold z-10">
                      {isCurrent ? (
                        <span className="bg-amber-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-widest animate-pulse">
                          TARGET
                        </span>
                      ) : isUnlocked ? (
                        <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                          SECURED
                        </span>
                      ) : (
                        <span className="text-zinc-600">🔒</span>
                      )}
                    </div>

                    {/* Level Name */}
                    <div className="my-auto text-center z-10">
                      <div
                        className={`text-[10px] uppercase font-bold tracking-wider ${isUnlocked ? "text-amber-500/60" : "text-zinc-700"}`}
                      >
                        SECTOR
                      </div>
                      <div
                        className={`text-4xl font-extrabold ${isUnlocked ? "text-white group-hover:scale-105 transition-transform" : "text-zinc-800"}`}
                      >
                        {lvlNum.toString().padStart(2, "0")}
                      </div>
                    </div>

                    {/* Level stars and action */}
                    <div className="w-full flex flex-col items-center gap-1 mt-auto z-10">
                      {/* Stars row */}
                      <div className="flex gap-1.5 justify-center">
                        {Array.from({ length: 3 }).map((_, starIdx) => {
                          const starFilled = starIdx < achievedStars;
                          return (
                            <span
                              key={starIdx}
                              className={`text-sm ${starFilled ? "text-yellow-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]" : "text-zinc-800"}`}
                            >
                              ★
                            </span>
                          );
                        })}
                      </div>
                      <div className="text-[8px] uppercase tracking-widest text-center mt-1">
                        {isCurrent ? (
                          <span className="text-yellow-400 font-extrabold">
                            DEPLOY FORCE
                          </span>
                        ) : isUnlocked ? (
                          <span className="text-zinc-400 group-hover:text-amber-400 transition-colors">
                            REPLAY AREA
                          </span>
                        ) : (
                          <span className="text-zinc-800 font-black">
                            ENCRYPTED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Menu */}
      {gameState.status === "menu" && (
        <div className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center z-50">
          <div
            className={`${slantClass} bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 p-6 border-4 border-white mb-8 shadow-2xl shadow-yellow-500/10`}
          >
            <h1 className="transform skew-x-12 text-5xl font-black italic tracking-tighter text-zinc-950 leading-none text-center uppercase">
              SOLSTICE
              <br />
              <span className="text-white text-6xl block mt-1 font-extrabold tracking-tight drop-shadow-md">
                ASSASSIN
              </span>
            </h1>
          </div>
          <div className="flex flex-col gap-3.5">
            <button
              onClick={startGame}
              className="group pointer-events-auto relative px-8 py-3 bg-transparent overflow-hidden border-2 border-white text-white font-black italic text-xl hover:text-black transition-colors duration-300 w-64"
            >
              <div className="absolute inset-0 w-0 bg-white transition-all duration-[250ms] ease-out group-hover:w-full"></div>
              <span className="relative">START MISSION</span>
            </button>
            <button
              onClick={() => setShowStory(true)}
              className="group pointer-events-auto relative px-8 py-3 bg-transparent overflow-hidden border-2 border-orange-500 text-orange-400 font-black italic text-xl hover:text-zinc-950 transition-colors duration-300 w-64"
            >
              <div className="absolute inset-0 w-0 bg-orange-500 transition-all duration-[250ms] ease-out group-hover:w-full"></div>
              <span className="relative">THE STORY LOGS</span>
            </button>
            <button
              onClick={openShop}
              className="group pointer-events-auto relative px-8 py-3 bg-transparent overflow-hidden border-2 border-yellow-500 text-yellow-500 font-black italic text-xl hover:text-black transition-colors duration-300 w-64"
            >
              <div className="absolute inset-0 w-0 bg-yellow-500 transition-all duration-[250ms] ease-out group-hover:w-full"></div>
              <span className="relative">ARMORY SHOP</span>
            </button>
            <button
              onClick={startTutorial}
              className="group pointer-events-auto relative px-8 py-2 bg-transparent overflow-hidden border border-zinc-500 text-zinc-400 font-bold text-sm hover:text-white transition-colors duration-300 w-64 mt-2"
            >
              <div className="absolute inset-0 w-0 bg-zinc-700 transition-all duration-[250ms] ease-out group-hover:w-full"></div>
              <span className="relative">HOW TO PLAY</span>
            </button>
          </div>
        </div>
      )}

      {/* Shop */}
      {gameState.status === "shop" && (
        <div className="absolute inset-0 bg-zinc-900 flex flex-col z-50 overflow-hidden">
          <div className="p-4 bg-black border-b border-white/20 flex justify-between items-center">
            <h2 className="text-3xl font-black italic text-yellow-500">
              ARMORY
            </h2>
            <div className="text-right">
              <p className="text-sm text-zinc-400">AVAILABLE CREDITS</p>
              <p className="text-2xl font-bold text-green-400">
                ${playerStats.credits}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start">
            {SKINS.map((skin) => {
              const isUnlocked = playerRef.current.unlockedSkins.includes(
                skin.id,
              );
              const isSelected = playerRef.current.selectedSkin === skin.id;
              const canAfford = playerRef.current.credits >= skin.cost;

              return (
                <div
                  key={skin.id}
                  className={`bg-zinc-800 p-4 border-2 ${isSelected ? "border-green-500 bg-green-900/10" : "border-zinc-700"} rounded-lg flex flex-col gap-2 relative overflow-hidden group`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">{skin.name}</h3>
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white/30"
                      style={{ backgroundColor: skin.colors.body }}
                    ></div>
                  </div>
                  <p className="text-xs text-zinc-400 mb-2">
                    {skin.description}
                  </p>

                  <div className="mt-auto">
                    {isUnlocked ? (
                      <button
                        onClick={() => buyOrEquipSkin(skin)}
                        className={`w-full py-2 font-bold text-sm uppercase ${isSelected ? "bg-green-600 text-white cursor-default" : "bg-white text-black hover:bg-zinc-200"}`}
                      >
                        {isSelected ? "EQUIPPED" : "EQUIP"}
                      </button>
                    ) : (
                      <button
                        onClick={() => buyOrEquipSkin(skin)}
                        disabled={!canAfford}
                        className={`w-full py-2 font-bold text-sm uppercase flex justify-between px-4 ${canAfford ? "bg-yellow-600 text-white hover:bg-yellow-500" : "bg-zinc-700 text-zinc-500 cursor-not-allowed"}`}
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
          <button
            onClick={quitGame}
            className="p-4 bg-zinc-800 border-t border-white/20 hover:bg-zinc-700 text-white font-bold text-center"
          >
            BACK TO MENU
          </button>
        </div>
      )}

      {/* Victory Appraisal Screen (Google AI Usage Category) */}
      {gameState.status === "victory" && !activeLevelResults && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-50 backdrop-blur-md p-4">
          <span className="text-emerald-400 text-xs font-black tracking-[0.2em] mb-1 animate-pulse uppercase">
            SECTOR SECURED
          </span>
          <h2 className="text-[38px] sm:text-5xl font-black italic text-white tracking-tighter mb-4 uppercase text-center select-none">
            PHASE{" "}
            <span className="text-emerald-400">{gameState.currentLevel}</span>{" "}
            INFILTRATED
          </h2>

          {/* Gemini appraisal typewriter readout */}
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded p-5 mb-5 font-mono text-xs leading-relaxed text-slate-300 relative select-text selection:bg-emerald-800">
            <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-800 pb-2 mb-3 select-none">
              <span>▲ DYNAMICAL COGNIZANT DEBRIEF</span>
              <span className="text-yellow-500 font-bold">GEMINI CORES</span>
            </div>
            <div className="max-h-48 overflow-y-auto whitespace-pre-wrap font-bold select-text text-slate-300">
              {postMissionSummary
                ? postMissionSummary
                : "Gathering dynamic tactical analysis..."}
            </div>
          </div>

          <button
            onClick={nextLevel}
            className="pointer-events-auto px-10 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 active:scale-95 text-slate-950 font-black text-sm tracking-widest uppercase transition-all rounded shadow-lg shadow-emerald-950/50"
          >
            INITIATE NEXT PROTOCOL &rarr;
          </button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.status === "gameover" && (
        <div className="absolute inset-0 bg-red-950/92 flex flex-col items-center justify-center z-50 backdrop-blur-md p-6">
          <h2 className="text-6xl font-black italic text-white mb-2 tracking-widest animate-pulse">
            K.I.A.
          </h2>
          <p className="text-red-400 font-black mb-2 uppercase tracking-widest text-[10px] font-mono">
            SOLSTICE PROTOCOL TERMINATED
          </p>

          <div className="bg-red-950/45 border border-red-900/40 rounded p-4 mb-8 text-center max-w-sm">
            {phaseRetries < 3 ? (
              <>
                <p className="text-amber-400 font-mono text-xs uppercase tracking-widest font-black mb-1">
                  ATTEMPT {phaseRetries + 1} / 4
                </p>
                <p className="text-[10px] text-slate-400 font-mono leading-normal">
                  Consciousness backup offline. Phase retries remaining:{" "}
                  <span className="text-white font-bold">
                    {3 - phaseRetries}
                  </span>
                  . Retrying will reset this Phase&apos;s recovered knowledge to
                  0%.
                </p>
              </>
            ) : (
              <>
                <p className="text-red-500 font-mono text-xs uppercase tracking-widest font-black mb-1 animate-pulse">
                  ATTEMPTS EXHAUSTED
                </p>
                <p className="text-[10px] text-red-300 font-mono leading-normal">
                  Data buffers corrupt. Connection lost. You must re-infiltrate
                  this level from{" "}
                  <span className="text-white font-bold">Phase 1</span>.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            {phaseRetries < 3 ? (
              <button
                onClick={retryLevel}
                className="pointer-events-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs tracking-wider uppercase transition-all rounded shadow-lg shadow-amber-950/50"
              >
                RETRY PHASE ({3 - phaseRetries} LEFT)
              </button>
            ) : (
              <button
                onClick={() => playSelectedLevel(selectedGameLevel)}
                className="pointer-events-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-orange-600 hover:brightness-110 active:scale-95 text-white font-black text-xs tracking-wider uppercase transition-all rounded shadow-lg shadow-red-950/50 animate-pulse border border-red-400/30"
              >
                RESTART FROM PHASE 1
              </button>
            )}
            <button
              onClick={quitGame}
              className="pointer-events-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-black text-xs tracking-wider uppercase transition-all rounded"
            >
              ABORT MISSION
            </button>
          </div>
        </div>
      )}

      {/* Pause Menu */}
      {gameState.status === "paused" && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur flex flex-col items-center justify-center z-50">
          <h2 className="text-4xl font-black italic text-white mb-8 select-none">
            SYSTEM PAUSED
          </h2>
          <div className="flex flex-col gap-4 w-48">
            <button
              onClick={pauseGame}
              className="pointer-events-auto py-3 bg-white text-slate-950 font-black hover:translate-x-2 transition-transform uppercase text-xs tracking-widest"
            >
              RESUME
            </button>
            <button
              onClick={quitGame}
              className="pointer-events-auto py-3 bg-transparent border border-white text-white font-black hover:translate-x-2 transition-transform uppercase text-xs tracking-widest"
            >
              QUIT TO MENU
            </button>
          </div>
        </div>
      )}

      {/* System Shutdown Deletion Ending Screen */}
      {gameState.status === "deleted" && (
        <DeletionOverlay
          currentLevel={gameState.currentLevel}
          credits={playerStats.credits}
          xp={playerStats.xp}
          onReset={startGame}
        />
      )}

      {/* Level Results Overlay */}
      {activeLevelResults && (
        <LevelResultsOverlay
          levelNumber={activeLevelResults.levelNumber}
          stars={activeLevelResults.stars}
          knowledgePoints={activeLevelResults.knowledgePoints}
          credits={activeLevelResults.credits}
          xp={activeLevelResults.xp}
          isNewUnlock={activeLevelResults.isNewUnlock}
          liberatedCount={liberatedCount}
          onReplay={() => playSelectedLevel(activeLevelResults.levelNumber)}
          onContinue={() => {
            const nextLvl = activeLevelResults.levelNumber + 1;
            playSelectedLevel(nextLvl);
          }}
          onGoToMenu={() => {
            setActiveLevelResults(null);
            setGameState((prev) => ({ ...prev, status: "levels" }));
          }}
        />
      )}

      {showStory && <StoryOverlay onClose={() => setShowStory(false)} />}

      {/* Settings Modal Overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-fade-in pointer-events-auto">
          <div className="bg-zinc-950 border border-yellow-500/25 p-6 rounded shadow-2xl max-w-sm w-full font-sans text-white relative flex flex-col gap-5">
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-yellow-500/45" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-yellow-500/45" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-yellow-500/45" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-yellow-500/45" />

            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] font-black tracking-widest text-yellow-500 uppercase block font-mono">
                CONSOLE DIRECTIVE
              </span>
              <h2 className="text-base font-black tracking-wider uppercase mt-1">
                SYSTEM AUDIO & COMMS
              </h2>
            </div>

            {/* Audio Toggle */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold font-mono text-slate-100 uppercase">
                  SYNTHESIZED SOUNDSCAPE
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  Ambient game music & procedural synth
                </span>
              </div>
              <button
                onClick={() => setSoundEnabled((prev) => !prev)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                  soundEnabled ? "bg-yellow-500" : "bg-zinc-800"
                }`}
              >
                <div
                  className={`w-4 h-4 bg-black rounded-full transition-transform duration-200 transform ${
                    soundEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Volume Control Slider */}
            <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
              <div className="flex justify-between items-center text-xs font-bold font-mono">
                <span className="text-slate-100 uppercase">MASTER VOLUME</span>
                <span className="text-yellow-400">
                  {Math.round(soundVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                disabled={!soundEnabled}
                className="w-full accent-yellow-500 h-1 bg-zinc-805 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              />
              <span className="text-[8.5px] font-mono text-yellow-500/80 uppercase">
                * SYSTEM SOUNDS ARE SET TO BE LOUD FOR DEEP FOCUS IMPRESSION.
              </span>
            </div>

            {/* Gemini voice toggle */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold font-mono text-emerald-400 uppercase">
                  📡 ALEX COMMS TRANSMISSION
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  Real-time Gemini voice commentary
                </span>
              </div>
              <button
                onClick={() => {
                  const nextVal = !geminiVoiceEnabled;
                  setGeminiVoiceEnabled(nextVal);
                  if (!nextVal && voiceClientRef.current) {
                    voiceClientRef.current.disconnect();
                    voiceClientRef.current = null;
                    setLiveVoiceStatus("disconnected");
                    setLiveVoiceError(null);
                  }
                }}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                  geminiVoiceEnabled ? "bg-emerald-500" : "bg-zinc-800"
                }`}
              >
                <div
                  className={`w-4 h-4 bg-black rounded-full transition-transform duration-200 transform ${
                    geminiVoiceEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Test Synthesizer Button */}
            <button
              onClick={() => {
                if (!soundEnabled) return;
                const testSynth = () => {
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const freqs = [261.63, 329.63, 392.00, 493.88, 587.33];
                  const now = audioCtx.currentTime;
                  freqs.forEach((f, idx) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(f, now + idx * 0.08);
                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.12 * soundVolume, now + idx * 0.08 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.2);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(now);
                    osc.stop(now + 1.5);
                  });
                };
                testSynth();
              }}
              disabled={!soundEnabled}
              className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-yellow-500/40 rounded text-[9.5px] font-black uppercase text-slate-300 transition shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              🔊 TEST SYNTH SIGNAL HARPS
            </button>

            {/* Close Options */}
            <button
              onClick={() => setShowSettings(false)}
              className="py-2.5 w-full font-mono text-xs font-black uppercase text-slate-950 bg-yellow-500 hover:bg-yellow-400 rounded tracking-widest transition-all duration-200 text-center pointer-events-auto"
            >
              DISMISS CONSOLE SYSTEM OPTIONS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
