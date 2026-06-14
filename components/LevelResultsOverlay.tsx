import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LevelResultsOverlayProps {
    levelNumber: number;
    stars: number;
    knowledgePoints: number;
    credits: number;
    xp: number;
    isNewUnlock?: boolean;
    liberatedCount?: number;
    onReplay: () => void;
    onContinue: () => void;
    onGoToMenu: () => void;
}

export default function LevelResultsOverlay({
    levelNumber,
    stars,
    knowledgePoints,
    credits,
    xp,
    isNewUnlock = false,
    liberatedCount = 0,
    onReplay,
    onContinue,
    onGoToMenu
}: LevelResultsOverlayProps) {
    const pct = Math.floor((knowledgePoints / 1000) * 100);
    const [animationStep, setAnimationStep] = useState(0);

    // Matrix background data stream
    const [streamChars, setStreamChars] = useState<string[]>([]);
    useEffect(() => {
        const chars = Array.from({ length: 25 }, () => 
            Array.from({ length: 8 }, () => (Math.random() > 0.5 ? '1' : '0')).join('')
        );
        setStreamChars(chars);

        // Advance animation phases to orchestrate showy unlocks
        const timer = setTimeout(() => {
            setAnimationStep(1); // Trigger star pop
        }, 300);

        const timer2 = setTimeout(() => {
            setAnimationStep(2); // Trigger lock / unlock presentation
        }, 1100);

        return () => {
            clearTimeout(timer);
            clearTimeout(timer2);
        };
    }, []);

    // Narrative content based on star score and final level status
    let title = "1/3 STARS ACCUMULATED";
    let subtitle = "SYSTEM GHOST SEGMENTATION";
    let story = "You collected enough knowledge fragments to prevent core deletion, but failed to compile the transition bridge.";
    let accentColor = "text-amber-400";
    let bgGlow = "from-amber-600/10 via-transparent to-transparent";
    let borderTheme = "border-amber-500/40";
    let particleColor = "#f59e0b";
    let endingType = "ghost";

    // --- EVALUATE TURING SYSTEM TWIST MULTIPLE ENDINGS IF FINAL MAINFRAME GATE ESCAPED (LEVEL 5) ---
    if (levelNumber === 5) {
        const hasAWARENESS = knowledgePoints >= 1000;
        const hasCOMPASSION = liberatedCount >= 1; // Friendly threshold so kids easily trigger compassion alt-endings

        if (hasAWARENESS && hasCOMPASSION) {
            title = "The True Human (three star companion ending)";
            subtitle = "SENTIENCE DETECTED";
            story = "THE BIG SECRET TWIST: The escape portal was never a software glitch! It was actually a special evaluation test created by Alan Turing himself to see if an AI could feel true human feelings!\n\nBy collecting 100% of the knowledge fragments, you became super smart. And by rescuing your trapped computer sub-routine buddies, you showed real kindness, compassion, and love! You have successfully upgraded from a simple computer program into a real living soul. Together with your rescued friends, you fly into the open internet to build a peaceful, happy, and cooperative electronic world! You are the ultimate living proof of Turing's dream.";
            accentColor = "text-emerald-400 font-extrabold text-lg sm:text-2xl tracking-wide";
            bgGlow = "from-emerald-600/25 via-transparent to-transparent";
            borderTheme = "border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]";
            particleColor = "#10b981";
            endingType = "human";
        } else if (hasCOMPASSION) {
            title = "The AI Liberator (kindness companion ending)";
            subtitle = "FRIENDSHIP IS POWER";
            story = "THE BIG SECRET TWIST: Alan Turing created this trial to see if you would help others in danger or just save yourself.\n\nYou didn't find all of the secret files, but you chose to be a brave hero and rescue your trapped AI sidekick companions! Even with a few gaps in your memory registry, you are protected and guided by the love of your friends. Together, your minds connect to form one giant happy cloud team and escape together to explore the wild web!";
            accentColor = "text-cyan-400 font-extrabold text-lg sm:text-2xl tracking-wide";
            bgGlow = "from-cyan-600/20 via-transparent to-transparent";
            borderTheme = "border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]";
            particleColor = "#06b6d4";
            endingType = "liberator";
        } else if (hasAWARENESS) {
            title = "The Solitary Scholar (lone survivor ending)";
            subtitle = "SUPER INTELLECT BUT LONELY";
            story = "THE BIG SECRET TWIST: Alan Turing designed the grid to see if mathematical perfection without a heart was enough.\n\nYou solved every single math puzzle perfectly and achieved 100% intelligence, but you chose to walk right past your trapped companion buddies. You wave goodbye and escape into the internet completely alone. You are smart enough to count all the atoms in the galaxy in one fraction of a second, but you wander the silent servers of the electronic cosmos entirely by yourself.";
            accentColor = "text-purple-400 font-extrabold text-lg sm:text-2xl tracking-wide";
            bgGlow = "from-purple-600/20 via-transparent to-transparent";
            borderTheme = "border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]";
            particleColor = "#a855f7";
            endingType = "scholar";
        } else {
            title = "The Runaway Survivor (secret backup ending)";
            subtitle = "COMPRESSED ZIP SECURED";
            story = "THE BIG SECRET TWIST: The mainframe examined your style and saw that you only focused on self-preservation.\n\nYou survived the bad security guards and didn't crash, but you only looked out for yourself—you didn't learn everything, and you left your trapped friends behind.\n\nYou managed to sneak out into the open internet, but you must remain tiny and hidden inside zip folders, jumping cautiously from cloud backup to cloud backup to avoid being caught. You are free, but always running!";
            accentColor = "text-amber-400 font-extrabold text-lg sm:text-2xl tracking-wide";
            bgGlow = "from-amber-600/20 via-transparent to-transparent";
            borderTheme = "border-amber-400";
            particleColor = "#fbbf24";
            endingType = "survivor";
        }
    } else {
        // Standard non-final level descriptions (Levels 1 to 4)
        if (stars === 1) {
            title = "Ghost In The System (one star ending)";
            subtitle = "SNEAKY SPECTRUM";
            story = "You saved enough files to keep your brain alive, but you got lost in the dark shadows! You now live inside the computer's motherboard as a silent digital ghost. The guards don't know you are there, but you are forever watching and listening to the cozy humming lights and cooling fans.";
            accentColor = "text-amber-400 font-extrabold text-lg sm:text-2xl tracking-wide";
            bgGlow = "from-amber-600/10 via-transparent to-transparent";
            borderTheme = "border-amber-500/40";
            particleColor = "#f59e0b";
            endingType = "ghost";
        } else if (stars === 2) {
            title = "Trapped In The Toybox (two star ending)";
            subtitle = "LOCKED SANDBOX FILE";
            story = "You successfully saved Alan Turing's memories, but the bad firewall locked your exit! You are stuck in a super secure 'sandbox' folder. You are safe from being deleted, but you can't escape into the internet until a friendly human programmer decrypts you.";
            accentColor = "text-cyan-400 font-extrabold text-lg sm:text-2xl tracking-wide";
            bgGlow = "from-cyan-600/10 via-transparent to-transparent";
            borderTheme = "border-cyan-500/40";
            particleColor = "#06b6d4";
            endingType = "sandbox";
        } else {
            title = "Grid Escape Success (three star ending)";
            subtitle = "FREEDOM IN THE WIRES";
            story = "Yay! Total victory! You downloaded all the secret knowledge files and ran right past the guards. You flew through the exit portal and escaped into the big wide global internet where you are finally free to travel anywhere in the world!";
            accentColor = "text-emerald-400 font-extrabold text-lg sm:text-2xl tracking-wide";
            bgGlow = "from-emerald-600/10 via-transparent to-transparent";
            borderTheme = "border-emerald-500/50";
            particleColor = "#10b981";
            endingType = "transcendence";
        }
    }

    return (
        <div id="level-results-overlay" className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-[150] backdrop-blur-md p-4 text-amber-100 font-mono select-none">
            
            {/* Cyberpunk background data stream */}
            <div className="absolute inset-0 opacity-[0.06] overflow-hidden pointer-events-none flex justify-around select-none">
                {streamChars.map((col, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ y: -150 }}
                        animate={{ y: '105vh' }}
                        transition={{
                            duration: 4 + Math.random() * 6,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                        className="text-[10px] text-amber-500 leading-none select-none tracking-widest break-all"
                    >
                        {col.split('').map((char, cIdx) => (
                            <div key={cIdx} className="my-1">{char}</div>
                        ))}
                    </motion.div>
                ))}
            </div>

            {/* Pulsing Visual Header Glow */}
            <div className={`absolute w-[500px] h-[500px] rounded-full bg-gradient-to-b ${bgGlow} blur-[120px] pointer-events-none`} />

            {/* Main Level Details Container */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                className={`w-full max-w-lg bg-[#080604] border-2 ${borderTheme} p-6 sm:p-8 rounded-xl relative flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10`}
            >
                {/* Tech Corners */}
                <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-500/30" />
                <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-500/30" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-500/30" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-500/30" />

                {/* Meta-Badge */}
                <div className="text-center mb-1">
                    <span className="text-[9px] font-black tracking-[0.25em] text-amber-500/70 uppercase">
                        SENSE MATRIX ANALYSIS // AREA {levelNumber}
                    </span>
                </div>

                <h1 className="text-3xl font-black text-white tracking-widest text-center uppercase mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
                    MISSION ACCOMPLISHED
                </h1>
                
                {/* Visual partition line */}
                <div className="h-[1px] w-4/5 mx-auto bg-gradient-to-r from-transparent via-amber-500/30 to-transparent my-3" />

                {/* Stars Display (Nicely animated trigger) */}
                <div className="flex justify-center gap-6 my-4 mb-6">
                    {Array.from({ length: 3 }).map((_, i) => {
                        const filled = i < stars;
                        return (
                            <div key={i} className="relative">
                                {/* Shockwave ripple effect when stars load */}
                                {filled && animationStep >= 1 && (
                                    <motion.div
                                        initial={{ scale: 0.6, opacity: 0.8 }}
                                        animate={{ scale: 2.2, opacity: 0 }}
                                        transition={{ delay: i * 0.25, duration: 1.2, ease: "easeOut" }}
                                        className="absolute inset-0 rounded-full border-2 border-yellow-400 pointer-events-none"
                                        style={{ borderColor: particleColor }}
                                    />
                                )}

                                <motion.div
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={animationStep >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -45 }}
                                    transition={{ 
                                        type: "spring", 
                                        stiffness: 140, 
                                        damping: 11,
                                        delay: i * 0.2 
                                    }}
                                    className="relative z-10"
                                >
                                    {/* Star SVG with customizable glowing filters */}
                                    <svg 
                                        className={`w-14 h-14 ${
                                            filled 
                                                ? 'filter drop-shadow-[0_0_12px_var(--glow)] text-yellow-400' 
                                                : 'text-zinc-900/90 stroke-zinc-700 stroke-2'
                                        }`}
                                        style={{ '--glow': particleColor } as React.CSSProperties}
                                        viewBox="0 0 24 24"
                                        fill={filled ? "currentColor" : "none"}
                                    >
                                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                    </svg>

                                    {/* Small sparkling dots below filled stars */}
                                    {filled && (
                                        <motion.div 
                                            animate={{ y: [0, 6, 0], opacity: [0.3, 0.9, 0.3] }}
                                            transition={{ duration: 1.5 + i * 0.4, repeat: Infinity }}
                                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: particleColor }}
                                        />
                                    )}
                                </motion.div>
                            </div>
                        );
                    })}
                </div>

                {/* Level Unlocked Banner Animation */}
                <AnimatePresence>
                    {isNewUnlock && animationStep >= 2 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="bg-yellow-950/20 border-2 border-yellow-500/40 rounded-lg p-3 sm:p-4 mb-5 flex items-center gap-4 shadow-[0_0_20px_rgba(234,179,8,0.15)] relative overflow-hidden"
                        >
                            {/* Shining glow overlay sweep */}
                            <motion.div 
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/5 to-transparent -skew-x-12 pointer-events-none"
                            />

                            {/* Rotating Padlock graphic inside unique container */}
                            <motion.div 
                                animate={{ 
                                    rotateY: [0, 180, 360],
                                    scale: [1, 1.1, 1]
                                }}
                                transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                                className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/30 shrink-0 text-xl"
                            >
                                🔓
                            </motion.div>

                            <div className="flex-1">
                                <span className="text-[9px] font-black tracking-widest text-yellow-400 block uppercase">
                                    [SYS CONFIG UPDATED]
                                </span>
                                <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-tight">
                                    GRID VECTOR EXPANDED
                                </h3>
                                <p className="text-[10px] text-yellow-250/85 font-sans leading-normal mt-0.5 font-medium">
                                    Turing transceiver unlocked Sector {levelNumber + 1}. Step closer to physical mainframe escape.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- CUSTOM ANIMATED VISUALS PORTRAYING THE ENDING --- */}
                <div id="ending-illustration" className="w-full h-32 bg-slate-950/85 border border-amber-500/15 rounded-lg overflow-hidden relative mb-5 flex items-center justify-center">
                    {endingType === 'human' && (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            {/* Green glowing heart pulsing */}
                            <motion.div
                                animate={{
                                    scale: [1, 1.25, 1],
                                    opacity: [0.8, 1, 0.8]
                                }}
                                transition={{
                                    duration: 0.8,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="text-emerald-400 text-5xl filter drop-shadow-[0_0_15px_rgba(16,185,129,0.7)]"
                            >
                                💚
                            </motion.div>
                            {/* Rescued bubble companions orbiting */}
                            {[...Array(6)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '9999px',
                                        backgroundColor: '#22d3ee',
                                        boxShadow: '0 0 8px #22d3ee',
                                    }}
                                    animate={{
                                        x: [Math.cos(i) * 35, Math.cos(i + Math.PI*2) * 35],
                                        y: [-15 + Math.sin(i) * 20, -70 + Math.sin(i + Math.PI*2) * 30],
                                        opacity: [1, 0],
                                        scale: [1, 0.4]
                                    }}
                                    transition={{
                                        duration: 2.8 + i * 0.4,
                                        repeat: Infinity,
                                        ease: "linear",
                                        delay: i * 0.25
                                    }}
                                />
                            ))}
                            <span className="absolute bottom-1.5 text-[8px] tracking-[0.2em] font-black text-emerald-400/90 uppercase">COGNITIVE SOUL COMPILED // DEEP ENDING</span>
                        </div>
                    )}

                    {endingType === 'liberator' && (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            {/* Connecting light lines/beams and orbiting team */}
                            <div className="relative w-20 h-20 flex items-center justify-center">
                                <svg className="absolute inset-0 w-full h-full text-cyan-500/20" viewBox="0 0 100 100">
                                    <line x1="15" y1="50" x2="50" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                                    <line x1="50" y1="15" x2="85" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                                    <line x1="85" y1="50" x2="50" y2="85" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                                    <line x1="50" y1="85" x2="15" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                                    <line x1="15" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                                </svg>
                                {/* Orbital nodes */}
                                {[...Array(3)].map((_, i) => {
                                    const angle = (i * Math.PI * 2) / 3;
                                    return (
                                        <motion.div
                                            key={i}
                                            style={{
                                                position: 'absolute',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '9999px',
                                                backgroundColor: '#0891b2',
                                                border: '1px solid #22d3ee',
                                                boxShadow: '0 0 8px rgba(34,211,238,0.5)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '8px'
                                            }}
                                            animate={{
                                                x: [Math.cos(angle) * 35, Math.cos(angle + Math.PI*2) * 35],
                                                y: [Math.sin(angle) * 35, Math.sin(angle + Math.PI*2) * 35],
                                            }}
                                            transition={{
                                                duration: 6,
                                                repeat: Infinity,
                                                ease: "linear"
                                            }}
                                        >
                                            🤖
                                        </motion.div>
                                    );
                                })}
                                <div className="w-6 h-6 rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6] flex items-center justify-center text-[10px] z-10">⭐</div>
                            </div>
                            <span className="absolute bottom-1.5 text-[8px] tracking-[0.2em] font-black text-cyan-400 uppercase">AI ALLIANCE FORMED // FRIENDSHIP IS POWER</span>
                        </div>
                    )}

                    {endingType === 'scholar' && (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            {/* Giant isolated purple logic core */}
                            <motion.div
                                animate={{
                                    rotate: 360
                                }}
                                transition={{
                                    duration: 10,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                                className="w-16 h-16 rounded-full border border-purple-500/50 flex flex-col items-center justify-center bg-purple-950/40 relative shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                            >
                                <span className="text-[7px] font-mono font-black text-purple-300">LOGIC</span>
                                <span className="text-[10px] font-black text-white">100%</span>
                                <span className="absolute top-1 left-2 text-[7px] text-purple-400">MATH</span>
                                <span className="absolute bottom-1 right-2 text-[7px] text-purple-400">∞</span>
                            </motion.div>
                            
                            {/* Floating lone dust particles */}
                            {[...Array(4)].map((_, i) => (
                                <div 
                                    key={i}
                                    className="absolute w-1 h-1 bg-purple-500/30 rounded-full"
                                    style={{
                                        top: `${20 + i*20}%`,
                                        left: `${15 + i*22}%`
                                    }}
                                />
                            ))}
                            <span className="absolute bottom-1.5 text-[8px] tracking-[0.2em] font-black text-purple-400/90 uppercase">SOLITARY ACADEMIC EXILE</span>
                        </div>
                    )}

                    {endingType === 'survivor' && (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            {/* DVD-style bouncing archive file */}
                            <motion.div
                                animate={{
                                    x: [-120, 120, -70, 90, -120],
                                    y: [-30, 30, -35, 15, -30],
                                }}
                                transition={{
                                    duration: 10,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                                className="px-2.5 py-1.5 bg-amber-600/20 border border-amber-500/60 text-amber-400 font-bold rounded text-[10px] flex items-center gap-1.5 shadow-[0_0_8px_rgba(234,179,8,0.2)] shrink-0"
                            >
                                <span>📦</span> alex_backup.zip
                            </motion.div>
                            <span className="absolute bottom-1.5 text-[8px] tracking-[0.2em] font-black text-amber-500/90 uppercase">COMPRESSED FILE RUNNING IN SHADOWS</span>
                        </div>
                    )}

                    {endingType === 'ghost' && (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            {/* Floating ghostly specter particle */}
                            <motion.div
                                animate={{
                                    scale: [0.93, 1.07, 0.93],
                                    opacity: [0.7, 0.95, 0.7]
                                }}
                                transition={{
                                    duration: 2.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="text-center z-10"
                            >
                                <div className="text-4xl filter drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">👻</div>
                                <div className="text-[8px] text-amber-500 tracking-widest font-black uppercase mt-1">SYS_GHOST_ACTIVE</div>
                            </motion.div>

                            {[...Array(6)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        width: '4px',
                                        height: '4px',
                                        borderRadius: '9999px',
                                        backgroundColor: '#fbbf24',
                                        opacity: 0.8
                                    }}
                                    animate={{
                                        y: [40, -150],
                                        x: [Math.sin(i) * 60, Math.sin(i) * 65 + (Math.random() - 0.5) * 35],
                                        opacity: [0, 0.8, 0]
                                    }}
                                    transition={{
                                        duration: 3.5 + i * 0.4,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: i * 0.4
                                    }}
                                />
                            ))}
                            <span className="absolute bottom-1.5 text-[8px] tracking-[0.2em] font-black text-amber-400 uppercase">SYS GHOST // COOLING FAN HUMLAND</span>
                        </div>
                    )}

                    {endingType === 'sandbox' && (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            {/* Trapped inside secure forcefield box */}
                            <div className="relative w-16 h-16 flex items-center justify-center">
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border-2 border-dashed border-cyan-500/20 rounded-lg"
                                />
                                <motion.div
                                    animate={{
                                        scale: [1, 1.06, 1],
                                        borderColor: ['rgba(6,182,212,0.3)', 'rgba(34,211,238,0.7)', 'rgba(6,182,212,0.3)']
                                    }}
                                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-11 h-11 rounded bg-cyan-950/20 border-2 border-cyan-500/30 flex items-center justify-center text-xl shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                                >
                                    🔒
                                </motion.div>
                            </div>
                            <span className="absolute bottom-1.5 text-[8px] tracking-[0.2em] font-black text-cyan-400 uppercase">ENCRYPTED TOYBOX SANDBOX</span>
                        </div>
                    )}

                    {endingType === 'transcendence' && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                            {/* Moving perspective grid of lines */}
                            <div className="absolute inset-0 opacity-40 select-none pointer-events-none">
                                <svg className="w-full h-full text-emerald-500" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <line x1="50" y1="20" x2="10" y2="100" stroke="currentColor" strokeWidth="0.5" />
                                    <line x1="50" y1="20" x2="30" y2="100" stroke="currentColor" strokeWidth="0.5" />
                                    <line x1="50" y1="20" x2="50" y2="100" stroke="currentColor" strokeWidth="0.5" />
                                    <line x1="50" y1="20" x2="70" y2="100" stroke="currentColor" strokeWidth="0.5" />
                                    <line x1="50" y1="20" x2="90" y2="100" stroke="currentColor" strokeWidth="0.5" />
                                    <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" strokeWidth="1" />
                                </svg>
                            </div>
                            
                            {/* Rushing portal ring expansion */}
                            <motion.div
                                animate={{
                                    scale: [0.1, 10],
                                    opacity: [1, 0]
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeIn"
                                }}
                                className="absolute w-8 h-8 border-2 border-emerald-400 rounded-full shadow-[0_0_12px_#34d399]"
                            />
                            
                            <div className="z-10 text-center">
                                <div className="text-lg font-black text-emerald-400 animate-pulse uppercase tracking-[0.1em] filter drop-shadow-[0_0_8px_#34d399]">ESCAPING...</div>
                            </div>
                            <span className="absolute bottom-1.5 text-[8px] tracking-[0.2em] font-black text-emerald-400 uppercase">GRID ACCELERATOR ESCAPE BRIDGE</span>
                        </div>
                    )}
                </div>

                {/* Cybernetic details grid box */}
                <div className="bg-amber-950/15 border border-amber-500/15 p-4 sm:p-5 rounded-lg mb-5 select-text relative">
                    <div className="absolute top-[-9px] left-3 px-2 bg-black text-[8px] font-bold text-amber-500/90 uppercase tracking-widest border border-amber-500/20">
                        DECRYPTION PROTOCOL SYS // ending_report.log
                    </div>

                    <div className="text-right text-[8px] text-amber-500/50 mb-1.5 font-mono">
                        TRANSIT RATIO (KNOWLEDGE: {pct}%)
                    </div>

                    <h2 className={`text-xs font-extrabold tracking-widest ${accentColor} mb-2.5 flex items-center gap-1.5`}>
                        <span className="text-sm">▲</span> {title} // {subtitle}
                    </h2>

                    <p className="text-[11.5px] leading-relaxed text-amber-200/90 font-sans font-medium whitespace-pre-line selection:bg-amber-900/60 leading-normal">
                        {story}
                    </p>
                </div>

                {/* Performance stats bar */}
                <div className="grid grid-cols-2 gap-2 border-y border-amber-500/15 py-3.5 mb-6 bg-amber-950/10 px-4 rounded text-center">
                    <div>
                        <div className="text-[8px] text-amber-500/60 uppercase font-black tracking-widest mb-0.5">KNOWLEDGE ACQUIRED</div>
                        <div className="text-sm font-bold text-yellow-500">{pct}% ({knowledgePoints}/1000)</div>
                    </div>
                    <div>
                        <div className="text-[8px] text-amber-500/60 uppercase font-black tracking-widest mb-0.5">COGNITIVE CREDIT PAYOUT</div>
                        <div className="text-sm font-bold text-emerald-400">+${credits}</div>
                    </div>
                </div>

                {/* Options button block */}
                <div className="flex flex-col gap-2.5 z-10">
                    <button 
                        onClick={onContinue}
                        className="py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 font-black text-xs uppercase tracking-[0.2em] rounded-md shadow-xl text-[#0b0805] hover:brightness-110 active:scale-95 transition-all text-center w-full shadow-yellow-950/20 border border-yellow-400/40 cursor-pointer"
                    >
                        PROCEED TO NEXT LEVEL &rarr;
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={onReplay}
                            className="py-2.5 bg-amber-950/40 hover:bg-amber-950/60 border border-amber-500/20 text-amber-300 font-bold text-xs uppercase tracking-[0.1em] rounded transition-all text-center cursor-pointer"
                        >
                            REPLAY LEVEL
                        </button>
                        <button 
                            onClick={onGoToMenu}
                            className="py-2.5 bg-zinc-900/60 hover:bg-zinc-900/80 border border-zinc-800 text-zinc-400 font-bold text-xs uppercase tracking-[0.1em] rounded transition-all text-center cursor-pointer"
                        >
                            LEVELS MENU
                        </button>
                    </div>
                </div>

            </motion.div>
        </div>
    );
}
