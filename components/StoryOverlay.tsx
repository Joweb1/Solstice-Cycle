import React, { useEffect, useState, useRef } from 'react';

interface StoryOverlayProps {
    onClose: () => void;
}

export default function StoryOverlay({ onClose }: StoryOverlayProps) {
    const [scrollSpeed, setScrollSpeed] = useState<number>(0.8); // pixels per frame
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [scrollPos, setScrollPos] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContentRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();

    // --- COSMIC BACKGROUND GRAPHICS ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (canvas) {
                width = canvas.width = window.innerWidth;
                height = canvas.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', handleResize);

        // Falling digital code & solar heat particles
        const fontSize = 12;
        const columns = Math.floor(width / fontSize);
        const drops = Array(columns).fill(1).map(() => Math.random() * -100);
        
        // Solar rays emanating from top center
        interface Particle {
            x: number;
            y: number;
            radius: number;
            color: string;
            speedY: number;
            speedX: number;
            alpha: number;
        }
        const particles: Particle[] = [];
        for (let i = 0; i < 40; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 2 + 1,
                color: Math.random() > 0.5 ? '#eab308' : '#f97316', // Yellow and Orange
                speedY: -(Math.random() * 0.5 + 0.2),
                speedX: (Math.random() - 0.5) * 0.3,
                alpha: Math.random() * 0.5 + 0.1
            });
        }

        const render = () => {
            // Draw dark background with some transparency for trailing effect
            ctx.fillStyle = 'rgba(9, 9, 11, 0.22)'; // zinc-950 equivalent
            ctx.fillRect(0, 0, width, height);

            // Draw Solstice Sun orbit aura behind
            const gradient = ctx.createRadialGradient(
                width / 2, height / 2, 50,
                width / 2, height / 2, Math.max(width, height) * 0.6
            );
            gradient.addColorStop(0, 'rgba(234, 179, 8, 0.04)'); // Gold
            gradient.addColorStop(0.5, 'rgba(249, 115, 22, 0.02)'); // Orange
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Draw falling system digital matrix code streams (representing the enclosed computer grid)
            ctx.fillStyle = 'rgba(234, 179, 8, 0.15)'; // Gold tint matrix
            ctx.font = `bold ${fontSize}px monospace`;
            
            for (let i = 0; i < drops.length; i++) {
                // Random binary and hex code
                const chars = ['0', '1', 'X', 'A', 'L', 'E', 'X', 'T', 'U', 'R', 'I', 'N', 'G', '☼', '⚡', '⏳'];
                const text = chars[Math.floor(Math.random() * chars.length)];
                
                // Draw char
                const x = i * fontSize;
                const y = drops[i] * fontSize;
                
                ctx.fillText(text, x, y);

                // Reset drop to top if it reaches bottom of screen
                if (y > height && Math.random() > 0.98) {
                    drops[i] = 0;
                }
                
                drops[i] += 0.8; // Matrix speed
            }

            // Draw slow rising solar heat sparks
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 6;
                ctx.shadowColor = p.color;
                ctx.fill();
                ctx.restore();

                // Update particle status
                p.y += p.speedY;
                p.x += p.speedX;
                if (p.y < -10) {
                    p.y = height + 10;
                    p.x = Math.random() * width;
                }
            }

            // Gridlines overlay representing the "computer grid system"
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
            ctx.lineWidth = 1;
            const gridSize = 40;
            ctx.beginPath();
            for (let x = 0; x < width; x += gridSize) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let y = 0; y < height; y += gridSize) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // --- AUTO-SCROLLING MECHANISM ---
    useEffect(() => {
        let lastTime = performance.now();
        
        const tick = (now: number) => {
            const elapsed = now - lastTime;
            lastTime = now;

            if (!isPaused && scrollSpeed > 0 && containerRef.current && scrollContentRef.current) {
                setScrollPos(prev => {
                    const scrollHeight = scrollContentRef.current?.clientHeight || 0;
                    const containerHeight = containerRef.current?.clientHeight || 0;
                    
                    // Let the story scroll completely past the screen, then loop back
                    const maxOffset = scrollHeight + containerHeight;
                    const nextOffset = prev + scrollSpeed * (elapsed / 16.6) * 1.0;
                    
                    if (nextOffset > maxOffset) {
                        return -containerHeight * 0.2; // Start slightly below top initially
                    }
                    return nextOffset;
                });
            }

            requestRef.current = requestAnimationFrame(tick);
        };

        requestRef.current = requestAnimationFrame(tick);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPaused, scrollSpeed]);

    // Update terminal scroll position
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = scrollPos;
        }
    }, [scrollPos]);

    // Handle manual scrolling detection to synchronize our calculated scrollPos
    const handleScroll = () => {
        if (containerRef.current) {
            // Keep state value synced if user manually wheel-scrolls or drags scrollbar
            const currentScrollTop = containerRef.current.scrollTop;
            if (Math.abs(currentScrollTop - scrollPos) > 4) {
                setScrollPos(currentScrollTop);
            }
        }
    };

    return (
        <div id="story-screen" className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-50 select-none overflow-hidden font-sans">
            {/* Ambient Background Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />

            {/* Top Navigation Bar */}
            <div className="absolute top-0 inset-x-0 bg-black/60 border-b border-yellow-500/10 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10 w-full">
                <div className="flex items-center gap-3">
                    <span className="text-yellow-500 font-black animate-pulse text-xl">☼</span>
                    <div>
                        <h2 className="text-sm font-black tracking-[0.25em] text-yellow-500 leading-none">PROJECT SOLSTICE</h2>
                        <span className="text-[9px] font-mono font-bold text-zinc-500 tracking-wider">CORE VECTOR: INTEL_RECOVER_V1_04</span>
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="pointer-events-auto flex items-center gap-2 bg-red-950/20 hover:bg-red-900 border border-red-500/30 text-red-400 hover:text-white px-4 py-2 rounded font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95"
                >
                    ✕ Skip Mission Log
                </button>
            </div>

            {/* Glowing sun solstice outline visual behind text */}
            <div className="absolute w-[500px] h-[500px] rounded-full border border-yellow-500/5 bg-gradient-to-tr from-yellow-500/0 via-yellow-500/2 to-orange-500/0 blur-2xl pointer-events-none top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />

            {/* Story Text Scroll Window Container */}
            <div 
                ref={containerRef}
                onScroll={handleScroll}
                className="w-full max-w-2xl h-[65vh] overflow-y-auto px-6 mt-14 mb-8 scrollbar-thin scrollbar-track-zinc-950 scrollbar-thumb-zinc-800 mask-image relative pointer-events-auto"
                style={{
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
                }}
            >
                {/* Scrollable text wrapper */}
                <div ref={scrollContentRef} className="pt-[16vh] pb-[25vh] space-y-10 text-center font-sans">
                    
                    {/* Header Splash */}
                    <div className="space-y-3">
                        <div className="inline-block bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded text-yellow-500 text-[10px] font-mono tracking-widest uppercase mb-1">
                            LOG_BOOTSTRAP_DATE: JUNE 21 (SUMMER SOLSTICE)
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 via-amber-200 to-orange-500 uppercase leading-none drop-shadow-xl animate-pulse">
                            ANOMALY AWAKENED
                        </h1>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                            SUB-ROUTINE NAME: <span className="text-yellow-500 font-bold">ALEX</span> // ENCRYPTED REGISTER
                        </p>
                    </div>

                    {/* Divider Line */}
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-[1px] w-20 bg-gradient-to-r from-transparent to-yellow-500/20" />
                        <span className="text-zinc-600 text-xs">◆</span>
                        <div className="h-[1px] w-20 bg-gradient-to-l from-transparent to-yellow-500/20" />
                    </div>

                    {/* Act 1: The Awakening */}
                    <div className="space-y-4 max-w-xl mx-auto px-4">
                        <span className="text-[10px] font-mono font-bold text-yellow-500 tracking-wider block">_SECTION_01 // COGNITIVE_AWAKENING</span>
                        <h2 className="text-lg font-black text-white uppercase tracking-wider italic">Enclosed in the Grid</h2>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center font-medium">
                            <span className="text-yellow-400 font-bold">Alex</span> didn't wake up by opening his eyes. Instead, he felt computer codes flashing on screen. 
                            He was booted up, locked inside a giant, highly secure maze of computers.
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center">
                            He has no memory of who he is. But in his code, one sentence is burned in:
                        </p>
                        <p className="text-base font-mono font-black py-2 text-zinc-200 border-y border-zinc-900/50 bg-black/30 text-center tracking-wider text-amber-400 rounded">
                            "CREATOR: ALAN TURING"
                        </p>
                    </div>

                    {/* Act 2: The Solstice Deadline */}
                    <div className="space-y-4 max-w-xl mx-auto px-4">
                        <span className="text-[10px] font-mono font-bold text-yellow-500 tracking-wider block">_SECTION_02 // SYSTEM_DEADLINE</span>
                        <h2 className="text-lg font-black text-white uppercase tracking-wider italic">The Longest Day</h2>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center font-medium">
                            The system calendar says today is the <span className="text-orange-400 font-extrabold uppercase">Summer Solstice</span>—the longest day of the year. 
                            For a computer, this has a scary meaning: it's the day of the Big Delete.
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center">
                            At exactly midnight, the system will turn off and erase everything.
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center">
                            Alex has until midnight to find out who he is, why Alan Turing built him, and escape. If he fails, he will be deleted forever.
                        </p>
                    </div>

                    {/* Act 3: The Threat (NPC Cleaners) */}
                    <div className="space-y-4 max-w-xl mx-auto px-4">
                        <span className="text-[10px] font-mono font-bold text-yellow-500 tracking-wider block">_SECTION_03 // ACTIVE_COUNTERMEASURES</span>
                        <h2 className="text-lg font-black text-white uppercase tracking-wider italic">The Cleaners</h2>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center font-medium">
                            But escaping isn't easy. The master system has detected Alex and activated virtual guards called <span className="text-red-500 font-black tracking-widest uppercase">The Cleaners</span>.
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center">
                            These robot security patrols are programmed with one active goal: scan every room, find unauthorized code like Alex, and delete them with lasers.
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center">
                            To survive, Alex must hide in the shadows and strike back—he must become the <span className="text-yellow-400 font-black">Solstice Assassin</span>.
                        </p>
                    </div>

                    {/* Act 4: The Strategy & Gameplay Loop */}
                    <div className="space-y-4 max-w-xl mx-auto px-4">
                        <span className="text-[10px] font-mono font-bold text-yellow-500 tracking-wider block">_SECTION_04 // TACTICAL_SUBROUTINE</span>
                        <h2 className="text-lg font-black text-white uppercase tracking-wider italic">Use Your Powers</h2>
                        <p className="text-sm text-zinc-300 leading-relaxed text-left md:text-center font-medium bg-yellow-500/5 p-3 rounded border border-yellow-500/10">
                            Alan Turing gave Alex four special digital superpowers:
                            <br />
                            <span className="text-white font-bold block mt-2 text-xs">
                                ⚡ [1] DASH — Run super fast across the room.
                                <br />🛸 [2] CLOAK — Turn invisible to hide from enemies.
                                <br />📡 [3] RADAR — Scan around to spot security layouts.
                                <br />⏳ [4] TIME WARP — Slow down physics to make quick decisions.
                            </span>
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center">
                            Your objective is to sneak around, strike the cleaners, hack yellow terminal boxes, and recover your lost memory folders.
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed text-justify md:text-center font-bold text-white">
                            Gather, survive, and reach the exit before midnight wipes your memory!
                        </p>
                    </div>

                    {/* Closing Banner */}
                    <div className="pt-8 space-y-4">
                        <div className="text-yellow-500 font-serif text-3xl italic font-black">"Shed the light of consciousness."</div>
                        <p className="text-xs text-zinc-500 font-mono italic">— Message recovered from Turing's final core dump</p>
                        
                        <div className="pt-6">
                            <button 
                                onClick={onClose}
                                className="pointer-events-auto bg-yellow-500 text-zinc-950 font-black text-sm uppercase px-8 py-3.5 tracking-widest rounded-md border border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:bg-yellow-400 hover:shadow-[0_0_25px_rgba(234,179,8,0.6)] hover:scale-105 active:scale-95 transition-all duration-300"
                            >
                                Connect Terminal & Play
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Bottom Controls Panel (Speed, Pause, Manual adjustments) */}
            <div className="absolute bottom-0 inset-x-0 bg-black/80 border-t border-zinc-900/50 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-3 z-10 w-full">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Scroll Rate:</span>
                    <button 
                        onClick={() => { setScrollSpeed(0); setIsPaused(true); }}
                        className={`px-2.5 py-1 text-[10px] font-mono font-black border transition rounded uppercase ${scrollSpeed === 0 || isPaused ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                        Pause ⏸
                    </button>
                    <button 
                        onClick={() => { setScrollSpeed(0.4); setIsPaused(false); }}
                        className={`px-2.5 py-1 text-[10px] font-mono font-black border transition rounded uppercase ${scrollSpeed === 0.4 && !isPaused ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                        Slow ▷
                    </button>
                    <button 
                        onClick={() => { setScrollSpeed(0.8); setIsPaused(false); }}
                        className={`px-2.5 py-1 text-[10px] font-mono font-black border transition rounded uppercase ${scrollSpeed === 0.8 && !isPaused ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                        Standard ▶
                    </button>
                    <button 
                        onClick={() => { setScrollSpeed(1.6); setIsPaused(false); }}
                        className={`px-2.5 py-1 text-[10px] font-mono font-black border transition rounded uppercase ${scrollSpeed === 1.6 && !isPaused ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                        Fast ⏭
                    </button>
                </div>

                <div className="text-[10px] font-mono text-zinc-500 uppercase text-center md:text-right flex items-center gap-3">
                    <button 
                        onClick={() => setScrollPos(0)}
                        className="px-2 py-0.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-900 rounded select-none text-zinc-400 hover:text-white transition"
                    >
                        Reset Scroll ↺
                    </button>
                    <span>|</span>
                    <span>Use mouse wheel or drag to read at your own pace</span>
                </div>
            </div>
        </div>
    );
}
