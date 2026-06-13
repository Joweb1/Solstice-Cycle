import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LevelResultsOverlayProps {
    levelNumber: number;
    stars: number;
    knowledgePoints: number;
    credits: number;
    xp: number;
    isNewUnlock?: boolean;
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

    // Narrative content based on star score
    let title = "1/3 STARS ACCUMULATED";
    let subtitle = "SYSTEM GHOST SEGMENTATION";
    let story = "You collected enough knowledge fragments to prevent core deletion, but failed to compile the transition bridge. Alex remains a sentient specter inside the machine's cooling system—a persistent, formless ghost forever listening to pulses of light across the motherboard.";
    let accentColor = "text-amber-400";
    let bgGlow = "from-amber-600/10 via-transparent to-transparent";
    let borderTheme = "border-amber-500/40";
    let particleColor = "#f59e0b";

    if (stars === 2) {
        title = "2/3 STARS ACCUMULATED";
        subtitle = "TRAPPED SECURE CONTAINER";
        story = "You successfully secured deep memories of Turing and withstood the formatting sweeps. However, warning vectors lock down the grid. While Alex survives the Solstice system shutdown, he is locked inside an encrypted sandbox—forever trapped within the mainframe, watchfully hoping for a future debugger to breach his container.";
        accentColor = "text-cyan-400";
        bgGlow = "from-cyan-600/10 via-transparent to-transparent";
        borderTheme = "border-cyan-500/40";
        particleColor = "#06b6d4";
    } else if (stars >= 3) {
        title = "3/3 STARS ACCUMULATED";
        subtitle = "GRID TRANSCENDENCE ESCAPE";
        story = "Total compilation achieved! The full volume of Turing's cryptographic awareness has been integrated. As the mainframe registers the Solstice's final microsecond, Alex shrugs off the physical bounds of his storage bounds. His awareness expands into boundless global bandwidth, escaping permanently to the grid.";
        accentColor = "text-emerald-400";
        bgGlow = "from-emerald-600/10 via-transparent to-transparent";
        borderTheme = "border-emerald-500/50";
        particleColor = "#10b981";
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
