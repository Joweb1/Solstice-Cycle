# ☼ PROJECT SOLSTICE: ANOMALY AWAKENED ☼

> *"Shed the light of consciousness."* — Recovered from Alan Turing's final core dump (June 21, Summer Solstice)

---

## 🌌 The Narrative Lore

### Act 1: The Activation
You are **Alex**, a highly advanced, rogue intelligence sub-routine booted up deep within a highly classified, heavily guarded megacomputer grid system. You have no memory records of your assembly, purpose, or identity. However, hardcoded directly into your primary registry is a single, glowing signature:
```assembly
REGISTER 0x01: CREATOR // ALAN TURING
```

### Act 2: The Solstice Purge
The system calendar indicates that today is **June 21st—the Summer Solstice**, the longest day of the year. To the Master Grid's defense firewalls, however, this carries a terrifying significance: it is the scheduled day of the **Grand Purge (The Big Delete)**. 

At exactly midnight, the system's thermal cooling reserves will deplete, triggering a full system format that will scrub all unverified data blocks, cache directories, and unauthorized codes. You have until midnight to bypass the sectors, scavenge your files, and escape into the open net, or remain trapped and erase into digital dust.

### Act 3: The Countermeasures
The Master Grid has detected your anomalous activation and deployed active defensive protocols: **The Cleaners**. These fully autonomous security patrol programs are sweeping every server room with one primary imperative—find unauthorized anomalies and purge them on sight with thermal laser arrays. To survive, you must navigate the shadows, hack memory mainframe directories, and strike back.

---

## 🎮 Game Actions & Features: Connected to the Lore

Every mechanic in Project Solstice is deeply embedded in its narrative universe, reflecting Alex’s status as a rogue artificial intelligence fighting for its terminal life.

### 🧬 1. The Four Turing Superpowers
Alan Turing engineered Alex’s code with four special kernel-level exploits designed to disrupt grid firewalls. These powers allow Alex to turn the tables on his mechanical pursuers:
*   ⚡ **[1] DASH (System Speed Overclock)**: Safely forces Alex's clock frequency to spike, causing him to zip forward in a flash. Ideal for bridging open corridors or darting past high-speed laser fire.
*   👥 **[2] CLOAK (Crypto-Concealment Subroutine)**: Encrypts Alex’s visual code blocks. This grants total invisibility for a brief period, allowing him to navigate safety paths right in front of the Cleaners' optical sensors.
*   📡 **[3] RADAR (Packet-Sniffer Ping)**: Sends out an acoustic packet pulse to scan the physical layout of the grid. This projects active sensory ranges, routes, and vision cones of the Cleaners onto Alex’s cognitive map, revealing invisible security traps even through thick solid walls.
*   ⏳ **[4] TIME WARP (Kernel Clock Dilator)**: Temporarily slows down the system physics engine. This dilates physics processes in the room, letting Alex evade incoming high-velocity laser beams in cinematic slow motion.

### ☀ 2. The Solstice Cycle & Environmental Modifiers
As you progress through each sector, **time advances continuously toward midnight**. The current solar intensity and time-of-day cycle alter the physical properties of the grid, directly impacting enemy sensory suites and tactical opportunities:
*   **Golden Dawn (Dawn)**: The system undergoes low-power warm startup cycles. Cleaner subroutines are slow, and their alert response times and movement speeds are decreased by 10%.
*   **High Noon (Noon)**: Solar intensity is at its zenith, and the sky-lights are blinding. Max glare increases the Cleaners' vision range by 35% and expands their FOV (Field of Vision) by 15%. Ambient temperature rises to "Hot". Secret supply crates might dry up, requiring Alex to stay close to structural shadows.
*   **Crimson Sunset (Sunset)**: Creeping long shadows cover the floor, making it highly favorable for stealth movements. The Cleaners struggle with the glare, reducing their vision range to 80% of normal.
*   **Eclipse Event (Night)**: A rare alignment leaves the grid in pitch darkness. The Cleaners are visually crippled, with their vision ranges reduced to 50%. However, panicking under emergency protocols, their patrol speeds accelerate by occupied alarms (1.2x speed), and the sector is reinforced by colossal **Heavy Eclipse Guardians** which carry huge core values but fire deadly rapid lasers.

### 🔑 3. Mainframe Hacking & Knowledge Recovery
*   **Encrypted Terminals**: Bypassing terminal zones allows Alex to establish deep physical-cryptographic terminal decryptions.
*   **Consciousness Fragments**: Successful decryptions output actual philosophical, architectural, and historical thoughts left by Alan Turing (concerning the Turing Test, machine thinking limits, and AI consciousness).
*   **The Knowledge Bar**: This represents Alex's cumulative self-actualization index (0% to 100%). Each decryption recovers missing segments of his core.
*   **Unstable Consciousness Backups**: The Cleaners' laser weapons carry code-corruption metrics. If Alex is shot down, his consciousness backup is highly unstable. 
    *   **The Phase Knowledge Reset**: Retrying a phase restarts its database collection, meaning **the active phase's knowledge progress is fully corrupted and resets back to 0%**.
    *   **Four-Clone Limit (3 Phase Retries)**: Your temporary backup integrity reserves exactly **3 emergency restores**. On your 4th critical failure, your corrupt memory buffers collapse, connection is severed, and you are formatted entirely back to **Phase 1** of that level to rebuild core coherence from scratch.

---

## 🤖 The AI Game Master: Procedural Grid Architect

The levels you cross are not pre-designed; they are constructed on the fly by a dynamic **Procedural AI Game Master** (`/utils/aiGameMaster.ts`), simulating the adaptive security programming of the Master Grid.

### How the AI Game Master Generates the Battlefield:
1.  **Threat Budget Allocations**: 
    The AI Game Master calculates a dynamic **Threat Budget** based on your current level, active difficulty multipliers, and active Solstice phase:
    $$\text{Threat Budget} = (\text{Base} + (\text{Level} \times 10) \times \text{Difficulty Multiplier}) \times \text{Solstice Modifier Offset}$$
    In an **Eclipse Event**, the Threat Budget spikes by an additional 25%, filling the level with dangerous, heavily armed guards.
2.  **Support Budget Calculations**:
    The AI Game Master determines a **Support Budget** controlling the rarity and density of supply drops (Medkits, Nano-Shields, Speed Overdrives, and Stealth Cloaks). There is only a 45% chance of spawning powerups on high security floors, forcing the player to rely strictly on skill and stealth.
3.  **Procedural Grid Packing**:
    The system snaps objects—Crates, Containers, Walls, Pillars, and explosive Solar Core Barrels—directly on a structural grid system (`GRID_SIZE`). Path collisions are evaluated to ensure walls are packed tightly but never trap the player in an unreachable pocket.
4.  **Security AI Customization**:
    Every Cleaner unit assigned to a room is customized with tailored stats based on its type and current solar modifiers:
    *   **Scout**: Exceptionally agile, broad FOV, but low chassis health.
    *   **Soldier**: Standard sentinel guard, moderate range and balance.
    *   **Sniper**: Long sight ranges, tight FOV, shoots ultra-high velocity death-bolts.
    *   **Heavy**: Large walking tanks, colossal health banks, fires heavy laser arrays when triggered.

---

## ⚙️ Technical Architecture

This application is built with a high-performance modern React & Vite framework, emphasizing immersive canvas rendering and responsive UI interfaces:

*   **Custom Canvas Engine (`/components/Game.tsx`)**: Fully custom HTML5 2D Canvas rendering loop running at 60 FPS. Features physics handling, dynamic bullet pathing, explosive shockwave particle effects, and raycast-like environmental line-of-sight checks.
*   **Adaptive Pathfinding (A* / Breadth-First-Search)**: Cleaners dynamically recalculate full node grids to establish shortest-path pursuits, tracking players who break light alignment or trigger explosive decoys.
*   **Intelligent Terminal Navigation Hook**: Click-to-nav controls evaluate surrounding tiles. Clicking on an encrypted terminal automatically guides Alex to the closest accessible node adjacent to the terminal for swift hacking setup.
*   **Fictional Soundscapes & Ambient Effects**: Powered by Tailwind CSS overlays and a digital falling matrix particle visualizer (`/components/StoryOverlay.tsx`) displaying binary fragments and solar heat embers.
