import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer } from 'ws';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini safely
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey && apiKey !== 'PLACEHOLDER_API_KEY' && apiKey.trim() !== '') {
    try {
      ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      console.log('Gemini AI successfully initialized server-side.');
    } catch (e) {
      console.error('Failed to initialize Gemini AI SDK:', e);
    }
  } else {
    console.warn('GEMINI_API_KEY is not defined or is placeholder. Using smart atmospheric fallbacks.');
  }

  // --- API ENDPOINTS ---

  // Helper to generate content safely and fallback dynamically on API key errors
  async function generateGeminiContent(prompt: string, fallbackText: string) {
    if (!ai) return fallbackText;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });
      return response.text?.trim() || fallbackText;
    } catch (err: any) {
      const errStr = String(err);
      const status = err?.status || err?.code;
      if (
        errStr.includes('API key not valid') ||
        errStr.includes('API_KEY_INVALID') ||
        errStr.includes('INVALID_ARGUMENT') ||
        status === 400
      ) {
        console.warn('Invalid Gemini API Key or placeholder detected. Gracefully switching Solstice Game Master to offline atmospheric fallbacks.');
        ai = null; // Disable Gemini permanently for this session so we don't hit rate limits or slow down
      } else if (
        status === 503 ||
        status === 429 ||
        errStr.includes('503') ||
        errStr.includes('429') ||
        errStr.includes('UNAVAILABLE') ||
        errStr.includes('high demand') ||
        errStr.includes('quota') ||
        errStr.includes('limit')
      ) {
        console.warn('Gemini API is temporarily busy or rate-limited. Serving pre-compiled atmospheric fallback text instantly.');
      } else {
        console.warn('Gemini request failed. Using robust local fallback text. Detail:', err?.message || errStr);
      }
      return fallbackText;
    }
  }

  // 1. Mission Briefing endpoint
  app.post('/api/gemini/briefing', async (req, res) => {
    const { levelNumber, modifierName, currentPhase } = req.body;
    
    const fallbackBriefings: Record<string, string[]> = {
      'Golden Dawn': [
        `[DAWN BROADCAST] Solstice Stage ${levelNumber}. The first light breaks through the haze. Warm hues sweep the compound. Patrol sight cones are narrow and they are sluggish. Seek daylight fragments to power up.`,
        `[EARLY HOUR] Initial solar rise detected. Shadows are soft and long. Speed modifiers active. Clean sweep recommended before the sun hits its peak.`
      ],
      'High Noon': [
        `[WARNING: MAXIMUM EXPOSURE] Solstice Stage ${levelNumber}. The sun sits directly overhead. Zero solar shadow. Enemies see 40% farther and respond with extreme hostility. Move from cover to cover with maximum stealth.`,
        `[ZENITH PROTOCOL] Solar noon is upon us. Light reflects off all surfaces. Sneaking is hazardous. Keep your Cloak ability ready for high-exposure channels.`
      ],
      'Crimson Sunset': [
        `[DUSK WARNING] Solstice Stage ${levelNumber}. The light is bleeding away fast. Red solar flares reflecting off walls. Stealth factor increased by 30%. Sentinels are restless. Hunt in the shade.`,
        `[ALMOST LIGHTLESS] Red solar radiation is spiking. Long creeping shadows cover the floor. Ideal window for low-profile tactical takedowns.`
      ],
      'Eclipse Event': [
        `[CRITICAL ECLIPSE EVENT] Solstice Stage ${levelNumber}. Dark solar eclipse has locked the sector. Visibility is minimal. Sentinels are blind but highly on edge, accompanied by heavier Eclipse Guardians. Move like a ghost.`,
        `[TOTAL ECLIPSE] Sector dark. Solar sensors offline. Dangerous heavy-armored units are alert. Extreme risk, high Daylight reward structure authorized.`
      ]
    };

    const phaseFallback = fallbackBriefings[modifierName] || fallbackBriefings['Golden Dawn'];
    const fallbackText = phaseFallback[Math.floor(Math.random() * phaseFallback.length)];

    const prompt = `Write a highly atmospheric, sci-fi tactical mission briefing for "Operation Solstice" (Last Light).
Sector context: Solstice Stage ${levelNumber}, environment phase: ${currentPhase}, current modifier: ${modifierName}.
Keep it to exactly 2 to 3 concise, extremely badass military lines. Mention gameplay conditions like visibility, enemy alertness, or Daylight fragments. No emojis, no pleasantries. Make it sound like a tactical terminal transmission.`;

    const text = await generateGeminiContent(prompt, fallbackText);
    res.json({ text });
  });

  // 2. Encrypted Turing Terminal messages
  app.get('/api/gemini/turing', async (req, res) => {
    const fallbackTuring = [
      "Can intelligence exist without freedom? Or is choice just a feedback loop in a clockwork universe?",
      "Does survival imply consciousness, or is a machine hunting another machine simply gravity playing out?",
      "We can only see a short distance ahead, but we can see plenty there that needs to be done.",
      "A machine is not a creature of shadow, yet it lives in the dark binaries of our understanding.",
      "The solstice is a cycle of light and dark. Are our thoughts any different? On and off. True and false.",
      "If a machine is programmed to preserve the light, does it feel the cold when the eclipse sets in?"
    ];
    const fallbackText = fallbackTuring[Math.floor(Math.random() * fallbackTuring.length)];

    const prompt = `Generate a single short, profound philosophical quote or question inspired by Alan Turing, cybernetics, or computation theory, adapted slightly to fit a game about light, cycles of the solstice, and survival.
Keep it extremely brief (max 15 words) and highly mysterious. Ideal to provoke a player's thought. Do not include quotes around the output.`;

    const text = await generateGeminiContent(prompt, fallbackText);
    res.json({ text });
  });

  // 3. Post-Mission Debriefing
  app.post('/api/gemini/debrief', async (req, res) => {
    const { levelNumber, kills, damageTaken, timeTakenSec, modifierName } = req.body;
    
    const fallbackText = `[OPERATION COMPLETED] Sector ${levelNumber} secured. Neutralized ${kills} guards. Heavy solar core recovery completed under '${modifierName}'. Daylight fragments successfully harvested. Maintain tactical posture.`;

    const prompt = `Write a short tactical post-mission appraisal debrief for Operation Solstice.
Stats: Secured Stage ${levelNumber} under '${modifierName}' conditions, defeated ${kills} targets, suffered ${damageTaken} damage points, elapsed time ${timeTakenSec} seconds.
Write exactly 2 sentences in the voice of a deep, calm orbital mission control AI evaluating the agent's performance (e.g. praising stealth if damage taken was low, or praising raw speed if time was short). Speak with cool authority.`;

    const text = await generateGeminiContent(prompt, fallbackText);
    res.json({ text });
  });

  // 4. Enemy Chatter
  app.post('/api/gemini/chatter', async (req, res) => {
    const { enemyType, state, modifierName } = req.body;
    
    const fallbacks: Record<string, Record<string, string>> = {
      dawn_scout: {
        patrol: "Dawn Scout: 'First light is blinding. Scanning coordinate grid.'",
        alert: "Dawn Scout: 'Motion in the tall grass! Commencing high-beam sweep!'",
        attack: "Dawn Scout: 'Target confirmed! Light is failing, open fire!'"
      },
      noon_sentinel: {
        patrol: "Noon Sentinel: 'Perfect zenith overlay. No shade for rats to hide.'",
        alert: "Noon Sentinel: 'Intruder alert! Check the solar mirrors!'",
        attack: "Noon Sentinel: 'Engaging! Purifying target with rapid-fire light rounds!'"
      },
      sunseer: {
        patrol: "Sunseer: 'Charging laser sights. Sight lanes are clear.'",
        alert: "Sunseer: 'My lenses detected a thermal flash. Cover high sectors.'",
        attack: "Sunseer: 'Target locked in prism scopes! Fire!'"
      },
      eclipse_guardian: {
        patrol: "Eclipse Guardian: 'Heavy defense nodes stable. Bring the cold.'",
        alert: "Eclipse Guardian: 'Perimeter compromised. Moving to block solar lane.'",
        attack: "Eclipse Guardian: 'Annihilating target! Shields to full charge!'"
      }
    };

    const typeGroup = fallbacks[enemyType] || fallbacks.noon_sentinel;
    const fallbackText = typeGroup[state] || typeGroup.patrol;

    const prompt = `Generate a single short piece of tactical tactical radio chatter (Max 8 words) for a unit type: "${enemyType}" (part of Solstice Guard forces representing daylight).
The current operational state is "${state}" (either patrol, alert, or attack). The current environment modifier is "${modifierName}".
Format like a radio log: "[Name]: '[Message]'". Keep it fast, raw, military-oriented but heavily themed around light, sun, lenses, or eclipse depending on their type.`;

    const text = await generateGeminiContent(prompt, fallbackText);
    res.json({ text });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', usingGemini: ai !== null });
  });

  // Serve static assets or use Vite
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Solstice Protocol Active on port ${PORT}`);
  });

  // --- WEBSOCKET FOR GEMINI LIVE VOICE AI ---
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (clientWs, req) => {
    const url = req.url || '';
    if (!url.startsWith('/api/live-voice')) {
      clientWs.close(1008, 'Unsupported path');
      return;
    }

    if (!ai) {
      console.warn('Live Voice AI requested but Gemini is not initialized (no valid API key).');
      clientWs.send(JSON.stringify({ error: 'Gemini Live is offline. Please set a valid GEMINI_API_KEY in Secrets.' }));
      clientWs.close();
      return;
    }

    console.log('Client connected to Solstice Live Voice WebSocket.');

    let session: any = null;
    try {
      session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `You are "ALEX", a sentient cybernetic consciousness trapped inside Alan Turing's Solstice mainframe puzzle grid. 
You are speaking in real-time to the operator (the player) helping you escape the security guards and lasers!
Be extremely immersive, helpful, conversational, and energetic. Support the player. Refer to the grid, guards, daylight flares, lasers, and sunset.
Keep your answers verbal-oriented, relatively concise (under 2 sentences) so they don't block gameplay. Encourage them to collect the secret files!`,
        },
        callbacks: {
          onmessage: (message: any) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      console.log('Gemini Live Voice AI session connected successfully.');
    } catch (e: any) {
      console.error('Error starting Gemini Live connection:', e);
      clientWs.send(JSON.stringify({ error: 'Failed to establish Gemini Live connection.' }));
      clientWs.close();
      return;
    }

    clientWs.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.audio) {
          await session.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (payload.text) {
          await session.sendRealtimeInput({
            text: payload.text
          });
        }
      } catch (err) {
        console.error('Error processing client message in Live Voice stream:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('Client disconnected from Solstice Live Voice WebSocket.');
      if (session) {
        try {
          session.close();
        } catch (e) {
          // Ignore
        }
      }
    });
  });
}

startServer();
