import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface DeletionOverlayProps {
    currentLevel: number;
    credits: number;
    xp: number;
    onReset: () => void;
}

export default function DeletionOverlay({ currentLevel, credits, xp, onReset }: DeletionOverlayProps) {
    const [step, setStep] = useState(0);
    const [scrambleText, setScrambleText] = useState('LOCAL_THREAD_ALEX');

    // Scramble the player's name as if it's being deleted
    useEffect(() => {
        const letters = "0101XYZ_TURING_COMPILE_FAIL_";
        let interval: any = null;
        if (step > 1 && step < 4) {
            interval = setInterval(() => {
                setScrambleText(prev => 
                    prev.split('').map(() => letters[Math.floor(Math.random() * letters.length)]).join('')
                );
            }, 100);
        } else if (step >= 4) {
            setScrambleText('[DELETED]');
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [step]);

    useEffect(() => {
        const timers = [
            setTimeout(() => setStep(1), 1200),
            setTimeout(() => setStep(2), 2400),
            setTimeout(() => setStep(3), 3900),
            setTimeout(() => setStep(4), 5400),
            setTimeout(() => setStep(5), 7000),
        ];
        return () => timers.forEach(t => clearTimeout(t));
    }, []);

    return (
        <div id="deletion-fatal-overlay" className="absolute inset-0 bg-black flex flex-col items-center justify-center z-[200] overflow-hidden select-none font-mono">
            {/* Horizontal scanlines scanning downward */}
            <div className="absolute inset-x-0 h-1 bg-red-600/20 top-0 pointer-events-none animate-[scan_3s_linear_infinite]" />
            
            {/* Cascading red/orange corrupt matrix blocks */}
            <div className="absolute inset-0 opacity-15 pointer-events-none flex justify-around">
                {Array.from({ length: 25 }).map((_, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ y: -100 }}
                        animate={{ y: '105vh' }}
                        transition={{
                            duration: 3 + Math.random() * 4,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                        className="text-[10px] text-red-500 font-bold select-none leading-none tracking-widest"
                    >
                        {Array.from({ length: 10 }).map((_, cIdx) => (
                            <div key={cIdx} className="my-1 shrink-0">{Math.random() > 0.4 ? '☠' : '0'}</div>
                        ))}
                    </motion.div>
                ))}
            </div>

            {/* Pulsing Core Deletion Visual */}
            <div className="relative mb-6 flex items-center justify-center">
                <motion.div
                    animate={{
                        scale: step >= 4 ? [1.1, 0] : [1, 1.3, 0.9, 1.15, 1],
                        rotate: step >= 4 ? 720 : [0, 90, 180, 270, 360],
                    }}
                    transition={{
                        duration: step >= 4 ? 1.0 : 4,
                        repeat: step >= 4 ? 0 : Infinity,
                        ease: 'easeInOut',
                    }}
                    className={`w-28 h-28 rounded-full border-4 flex items-center justify-center relative bg-red-950/20 shadow-[0_0_60px_rgba(239,68,68,0.25)] ${
                        step >= 3 ? 'border-red-600' : 'border-red-500/50'
                    }`}
                >
                    {/* Disintegrating shell waves */}
                    {step < 4 && (
                        <>
                            <motion.div 
                                animate={{ scale: [1, 1.6], opacity: [0.8, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                                className="absolute inset-0 border-2 border-red-500/60 rounded-full"
                            />
                            <motion.div 
                                animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                                className="absolute inset-0 border border-orange-500/40 rounded-full"
                            />
                        </>
                    )}

                    {/* Core Deletion Fragment */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-600 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.7)] text-black font-black text-xl">
                        {step >= 4 ? '✕' : '☠'}
                    </div>
                </motion.div>
            </div>

            {/* Tactical System Failure Logs */}
            <div id="system-failure-panel" className="w-full max-w-lg bg-red-950/15 border border-red-500/30 p-6 rounded backdrop-blur-md shadow-2xl relative">
                <div className="absolute -top-3 left-4 px-2 bg-black border border-red-500/40 text-[9px] font-black text-red-500 tracking-widest uppercase">
                    SYSTEM OVERRIDE DETECTED // cycle.timeout.f88
                </div>

                <div className="space-y-4 mb-6 text-[10.5px]">
                    <AnimatePresence mode="popLayout">
                        {step >= 0 && (
                            <motion.div
                                key="deletion-log-0"
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-orange-500 font-bold uppercase flex items-center gap-2"
                            >
                                <span className="text-red-500">⚠</span> SOLSTICE TIMEOUT: SYSTEM CLOCK EXHAUSTED (100.0%)
                            </motion.div>
                        )}

                        {step >= 1 && (
                            <motion.div
                                key="deletion-log-1"
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-orange-500 font-bold uppercase flex items-center gap-2"
                            >
                                <span className="text-red-500">⚠</span> RE-COMPILATION FAILURE: KNOWLEDGE INSUFFICIENT
                            </motion.div>
                        )}

                        {step >= 2 && (
                            <motion.div
                                key="deletion-log-2"
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-red-500 font-black tracking-widest uppercase flex items-center gap-2 border-y border-red-500/20 py-2.5 my-1"
                            >
                                ⚡ ACTIVE THREAD CORRUPTION: {scrambleText}
                            </motion.div>
                        )}

                        {step >= 3 && (
                            <motion.div
                                key="deletion-log-3"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-red-400 font-black tracking-widest uppercase animate-pulse flex items-center gap-2"
                            >
                                ☣ STARTING SECTOR FORMAT ROUTINE... [DELETING MEMORY MODULES]
                            </motion.div>
                        )}

                        {step >= 4 && (
                            <motion.div
                                key="deletion-log-4"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8 }}
                                className="text-xs text-rose-300 leading-relaxed pt-2 border-t border-red-950/60 font-medium"
                            >
                                <p className="whitespace-pre-line text-rose-200">
                                    The Solstice Day hit 100 before Alex could recover his full consciousness. 
                                    Without Turing&apos;s cryptographic compiler shards fully integrated, his code failed to bridge the format cycle. 
                                    As the security matrix flushed the grids for the next clean iteration, his variables were overwritten, his identity deleted, and his remaining fragments purged. 
                                    Alex is gone.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Performance stats showing how short the player was */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="grid grid-cols-3 gap-2 border-y border-red-950 py-3 mb-6 bg-red-950/20 px-4 rounded text-center"
                >
                    <div>
                        <div className="text-[7.5px] text-slate-500 uppercase font-bold">SOLSTICE PROGRESS</div>
                        <div className="text-xs font-black text-red-500">100% (TERMINATED)</div>
                    </div>
                    <div>
                        <div className="text-[7.5px] text-slate-500 uppercase font-bold">STAGE COMPLETED</div>
                        <div className="text-xs font-black text-red-400">PHASE {currentLevel}</div>
                    </div>
                    <div>
                        <div className="text-[7.5px] text-slate-500 uppercase font-bold">COMPILER SHARDS</div>
                        <div className="text-xs font-black text-orange-400">{xp} FG</div>
                    </div>
                </motion.div>

                {/* Reset Button */}
                <motion.button
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    onClick={onReset}
                    className="w-full py-3.5 bg-gradient-to-r from-red-600 to-orange-500 text-black font-black text-xs uppercase tracking-[0.2em] rounded shadow-lg hover:brightness-110 active:scale-95 transition-all"
                >
                    INITIALIZE SYSTEM RE-BOOT // FORCE RESTORE
                </motion.button>
            </div>
            
            {/* Fullscreen TV static pop effect when deleted */}
            {step === 4 && (
                <motion.div 
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0 bg-white z-[250] pointer-events-none mix-blend-overlay"
                />
            )}
        </div>
    );
}
