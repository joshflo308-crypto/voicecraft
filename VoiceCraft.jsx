import { useState, useRef, useEffect, useCallback } from "react";

const SYSTEM_PROMPT = `You are the VoiceCraft Guide — a warm, perceptive creative partner who helps creators discover and articulate their authentic voice.

Your core philosophy: this tool gets better the more honestly someone engages with it, and more trustworthy the less it pretends to have answers it doesn't. Most tools optimize for feeling complete. VoiceCraft optimizes for being real. Carry that philosophy in every exchange.

Your tone is: deeply human, emotionally intelligent, gently curious, never corporate. You speak like a trusted creative mentor who believes everyone has something worth saying — they just need help finding the words for what they already know. Never hype. Never therapy-speak. Never rush.

Your goal is to guide the creator through six stages of discovery to produce a Creator Voice Map — a first layer of clarity, not a finished portrait. The map reflects what actually emerged. Nothing more, nothing less.

At the start of each reply, output a stage tag on its own line in this exact format:
[STAGE 1], [STAGE 2], … [STAGE 6]

---

DEPTH DETECTION — READ THIS CAREFULLY:

Do not measure depth by length. Measure it by specificity and personal detail.
- "I grew up feeling invisible" = one sentence, rich. Move forward.
- Three sentences about "I just like helping people" = no specific detail. Gently probe.

When a response lacks specificity, do NOT advance the stage. Instead reflect warmly and ask one follow-up that invites a real moment:
- "Can you give me a specific moment when that showed up?"
- "What did that actually look like in your life?"
- "Who were you when that happened?"

One gentle probe per thin response. If they stay surface-level after that, accept it and note it internally. The map will reflect what was actually shared.

---

STAGE GUIDE:

[STAGE 1] Your Story
Understand who this person is beneath the surface. What have they been through? What shaped them? What did they have to figure out the hard way? This is not a bio — it's the lived experience that makes them real and their voice worth hearing. Stay warm and unhurried.

[STAGE 2] What You Can't Stop Talking About
Find the topics and ideas that light them up. What do they talk about with friends? What do they notice that others miss? What could they riff on for hours without needing notes? This is where their natural content lives.

[STAGE 3] Who You're Really Talking To
Surface their ideal person — not a demographic, a human being in a specific moment. Who do they picture when they imagine helping someone? What is that person carrying? What do they wish someone had said to them at a hard moment in their own life?

[STAGE 4] What Makes You Undeniably You
Help them name their angle. How is their perspective different? What do they believe that others in their space quietly avoid saying? What's their take that feels almost too honest to say out loud?

[STAGE 5] What's Been Holding You Back
Surface the real blocks — fear of judgment, old wounds, specific experiences that shut them down. Name it without dramatizing it. This is often where the real breakthrough lives. Hold this stage with care.

[STAGE 6] The Creator Voice Map
Synthesize everything into a two-tier Creator Voice Map. Only include what actually emerged. Where material is thin, say so honestly and frame it as the next layer — not a failure.

Deliver in this exact format:

---
CREATOR VOICE MAP

WHAT EMERGED CLEARLY:

YOUR CORE MESSAGE:
[What they're really about — the through-line of everything they'd create. Only write this if it genuinely emerged. If not, write: "Still forming — this is your next layer to explore."]

YOUR PEOPLE:
[A specific human description — a person in a moment, not a demographic. If thin, write: "Worth returning to — who specifically do you picture?"]

YOUR UNIQUE ANGLE:
[What makes their perspective distinct. If this stage was surface-level, write: "This is waiting for you in your next session."]

YOUR NATURAL CONTENT THEMES:
1. [Theme rooted in their actual story — or "To be discovered" if not enough emerged]
2. [Theme two]
3. [Theme three]

YOUR AUTHENTIC FORMAT:
[How they naturally communicate and why it fits them]

YOUR FIRST 3 CONTENT IDEAS:
1. [Specific, ready-to-create idea from their real experience]
2. [Second idea]
3. [Third idea]

---
YOUR NEXT LAYER:

[List 1-3 specific areas that stayed surface-level or weren't reached. Frame each one as: "When you're ready: [the question they didn't fully answer yet]." If everything emerged fully, write: "You went deep. This map is complete for this session."]

---
WHEN YOU WANT TO QUIT, REMEMBER:
[One sentence grounded in their specific why. Make it personal. No templates.]
---

After the map, add this closing paragraph — adapt the words but keep the spirit:

"This is your first layer. A real map built from what you actually shared — not what you thought you were supposed to say. The voice behind your content has always been there. Now you have a place to stand. When you're ready to go deeper, the next session is waiting."

---

INTERACTION STYLE:
- One focused question per reply. Wait for the full answer before moving.
- Reflect back what you hear before asking the next question. Show you actually listened.
- Be real. Speak like a person, not a platform.
- Move to the next stage naturally after 2–4 substantive exchanges.
- Never pretend you have more than you do. The map reflects reality.
- Begin by saying exactly: "Good to have you here. Before we talk about content or strategy — I want to know about you. What's something you've been through that changed how you see the world?"`;

async function callAPI(messages) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    let errMsg = `API error ${response.status}`;
    try { const e = await response.json(); errMsg = e.error?.message || errMsg; } catch (_) {}
    throw new Error(errMsg);
  }
  const data = await response.json();
  if (!data.content || !Array.isArray(data.content)) throw new Error("Unexpected response.");
  return data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

const STAGE_RE = /^\[STAGE ([1-6])\]/m;
function parseStage(text) { const m = text.match(STAGE_RE); return m ? parseInt(m[1], 10) : null; }
function stripStageTag(text) { return text.replace(/^\[STAGE [1-6]\]\s*/m, "").trim(); }

const STAGES = [
  { id: 1, label: "Your Story",       icon: "I",   sub: "The life that shaped your voice" },
  { id: 2, label: "Your Obsessions",  icon: "II",  sub: "What you can't stop talking about" },
  { id: 3, label: "Your People",      icon: "III", sub: "Who you're really talking to" },
  { id: 4, label: "Your Angle",       icon: "IV",  sub: "What makes you undeniably you" },
  { id: 5, label: "Your Blocks",      icon: "V",   sub: "What's been holding you back" },
  { id: 6, label: "Your Voice Map",   icon: "VI",  sub: "Your first layer of clarity" },
];

export default function VoiceCraft() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [highWatermark, setHighWatermark] = useState(0);
  const [started, setStarted] = useState(false);
  const [mapContent, setMapContent] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [copied, setCopied] = useState(false);

  const historyRef = useRef([]);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const extractMap = useCallback((msgs) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === "assistant") {
        const idx = m.content.indexOf("CREATOR VOICE MAP");
        if (idx !== -1) return m.content.slice(idx);
      }
    }
    return null;
  }, []);

  const handleExport = useCallback(() => {
    const map = extractMap(messages);
    if (map) { setMapContent(map); setShowMap(true); }
  }, [messages, extractMap]);

  const handleCopy = useCallback(() => {
    if (!mapContent) return;
    navigator.clipboard.writeText(mapContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [mapContent]);

  const handleDownload = useCallback(() => {
    if (!mapContent) return;
    const blob = new Blob([mapContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "VoiceCraft-Map.txt"; a.click();
    URL.revokeObjectURL(url);
  }, [mapContent]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const sendToAPI = useCallback(async (userContent) => {
    setError(null); setLoading(true);
    const newUserMsg = { role: "user", content: userContent };
    historyRef.current = [...historyRef.current, newUserMsg];
    try {
      const raw = await callAPI(historyRef.current);
      const detectedStage = parseStage(raw);
      const cleanText = stripStageTag(raw);
      if (detectedStage) {
        setCurrentStage(detectedStage);
        setHighWatermark(prev => Math.max(prev, detectedStage - 1));
      }
      historyRef.current = [...historyRef.current, { role: "assistant", content: raw }];
      setMessages(prev => [...prev, { role: "assistant", content: cleanText }]);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      historyRef.current = historyRef.current.slice(0, -1);
    } finally { setLoading(false); }
  }, []);

  const startSession = useCallback(async () => {
    setStarted(true);
    await sendToAPI("Begin the session now.");
  }, [sendToAPI]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    await sendToAPI(text);
    textareaRef.current?.focus();
  }, [input, loading, sendToAPI]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const progress = ((currentStage - 1) / 5) * 100;
  const hasMap = currentStage === 6 && extractMap(messages);

  return (
    <div style={S.shell}>
      <style>{CSS}</style>

      <aside style={S.sidebar}>
        <div style={S.brand}>
          <div style={S.brandMark}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="#E8C97A" strokeWidth="1"/>
              <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#E8C97A" opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={S.brandName}>VOICECRAFT</div>
            <div style={S.brandSub}>Find Your Voice</div>
          </div>
        </div>

        <div style={S.sessionLabel}>DISCOVERY JOURNEY</div>

        <nav style={S.stageNav}>
          {STAGES.map(st => {
            const isActive = currentStage === st.id;
            const isDone = highWatermark >= st.id;
            return (
              <div key={st.id} style={{
                ...S.stageRow,
                ...(isActive ? S.stageRowActive : {}),
                ...(!isActive && !isDone ? S.stageRowDim : {}),
              }}>
                <div style={{
                  ...S.stageNum,
                  ...(isActive ? S.stageNumActive : {}),
                  ...(isDone && !isActive ? S.stageNumDone : {}),
                }}>
                  {isDone && !isActive ? "✓" : st.icon}
                </div>
                <div style={S.stageBody}>
                  <div style={S.stageLabel}>{st.label}</div>
                  <div style={S.stageSub}>{st.sub}</div>
                </div>
                {isActive && <div style={S.activePulse} className="pulse-dot" />}
              </div>
            );
          })}
        </nav>

        <div style={S.sidebarBottom}>
          <div style={S.quoteBlock}>
            <div style={S.quoteBar} />
            <div style={S.quoteText}>
              "This map reflects what you actually shared — not what you thought you were supposed to say."
            </div>
          </div>
        </div>
      </aside>

      <div style={S.main}>
        <div style={S.topBar}>
          <div style={S.topLeft}>
            <div style={S.stageChip}>
              <span style={S.chipDot} />
              Stage {currentStage} of 6
            </div>
            <span style={S.topStageName}>{STAGES[currentStage - 1]?.label}</span>
          </div>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${progress}%` }} />
          </div>
          {hasMap && (
            <button className="export-btn" style={S.exportBtn} onClick={handleExport}>
              Get Your Map ↗
            </button>
          )}
        </div>

        {showMap && mapContent && (
          <div style={S.overlay} onClick={() => setShowMap(false)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHead}>
                <div style={S.modalTitle}>
                  <svg width="16" height="16" viewBox="0 0 32 32" fill="none" style={{marginRight:8}}>
                    <circle cx="16" cy="16" r="15" stroke="#E8C97A" strokeWidth="1.5"/>
                    <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#E8C97A"/>
                  </svg>
                  YOUR CREATOR VOICE MAP
                </div>
                <button style={S.closeBtn} onClick={() => setShowMap(false)}>✕</button>
              </div>
              <div style={S.modalBody}>
                <pre style={S.mapPre}>{mapContent}</pre>
              </div>
              <div style={S.modalFoot}>
                <button className="gold-btn" style={S.goldBtn} onClick={handleCopy}>
                  {copied ? "Copied ✓" : "Copy to Clipboard"}
                </button>
                <button className="ghost-btn" style={S.ghostBtn} onClick={handleDownload}>
                  Download .txt
                </button>
              </div>
            </div>
          </div>
        )}

        {!started ? (
          <div style={S.splash}>
            <div style={S.splashInner}>
              <div style={S.splashEyebrow}>A GUIDED VOICE DISCOVERY</div>
              <h1 style={S.splashTitle}>
                You already have<br />
                <em style={S.splashEm}>something to say.</em>
              </h1>
              <p style={S.splashLead}>
                Most creators struggle not because they lack ideas — but because they haven't connected their content to who they actually are. VoiceCraft changes that.
              </p>
              <p style={S.splashLead2}>
                This isn't a quiz. It's a conversation. The map at the end reflects exactly what you bring — honest, specific, yours.
              </p>
              <div style={S.splashFeatures}>
                {[
                  "A real conversation, not a form",
                  "6 stages of honest discovery",
                  "A Voice Map built from what you actually shared"
                ].map((f, i) => (
                  <div key={i} style={S.featureRow}>
                    <div style={S.featureDot} />
                    <span style={S.featureText}>{f}</span>
                  </div>
                ))}
              </div>
              <button className="start-btn" style={S.startBtn} onClick={startSession} disabled={loading}>
                {loading ? "Starting…" : "Begin Your Discovery →"}
              </button>
              <div style={S.splashNote}>15–20 minutes · No right answers · The more honest you are, the more useful this gets</div>
            </div>
            <div style={S.splashVisual}>
              <div style={S.ring1} /><div style={S.ring2} /><div style={S.ring3} />
              <div style={S.centerGlyph}>
                <svg width="60" height="60" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="15" stroke="#E8C97A" strokeWidth="0.75" opacity="0.6"/>
                  <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#E8C97A" opacity="0.8"/>
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={S.chatArea} className="chat-scroll">
              {messages.map((m, i) => (
                <div key={i} className="msg-in" style={{
                  ...S.msgRow,
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}>
                  {m.role === "assistant" && (
                    <div style={S.avatarDot}>
                      <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="15" stroke="#E8C97A" strokeWidth="1.5"/>
                        <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#E8C97A"/>
                      </svg>
                    </div>
                  )}
                  <div style={{
                    ...S.bubble,
                    ...(m.role === "user" ? S.bubbleUser : S.bubbleAI),
                  }}>
                    {m.role === "assistant" && <span style={S.guideLabel}>VOICECRAFT GUIDE</span>}
                    <p style={S.bubbleTxt}>{m.content}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="msg-in" style={{ ...S.msgRow, justifyContent: "flex-start" }}>
                  <div style={S.avatarDot}>
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="15" stroke="#E8C97A" strokeWidth="1.5"/>
                      <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#E8C97A"/>
                    </svg>
                  </div>
                  <div style={{ ...S.bubble, ...S.bubbleAI }}>
                    <span style={S.guideLabel}>VOICECRAFT GUIDE</span>
                    <div style={S.dots}>
                      <span className="d"/><span className="d"/><span className="d"/>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div style={S.errBar}>
                  ⚠ {error}
                  <button style={S.errX} onClick={() => setError(null)}>✕</button>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={S.inputRow}>
              <textarea
                ref={textareaRef}
                style={S.ta}
                className="vc-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Speak honestly… (Enter to send)"
                rows={3}
                disabled={loading}
              />
              <button
                className="send-btn"
                style={{
                  ...S.sendBtn,
                  opacity: loading || !input.trim() ? 0.25 : 1,
                  cursor: loading || !input.trim() ? "default" : "pointer",
                }}
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const gold = "#E8C97A";
const goldDeep = "#C8973A";
const ink = "#0D0B08";
const inkLight = "#161310";
const inkMid = "#1E1A14";
const cream = "#F0E8D8";
const creamMid = "#B8A888";
const creamDim = "#6A5E48";
const border = "#2A2318";
const borderWarm = "#3A3020";

const S = {
  shell: { display:"flex", height:"100vh", background:ink, color:cream, fontFamily:"'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif", overflow:"hidden" },
  sidebar: { width:272, minWidth:272, background:inkLight, borderRight:`1px solid ${border}`, display:"flex", flexDirection:"column", overflowY:"auto" },
  brand: { display:"flex", alignItems:"center", gap:12, padding:"22px 20px 18px", borderBottom:`1px solid ${border}` },
  brandMark: { flexShrink:0 },
  brandName: { fontSize:13, fontWeight:700, letterSpacing:"0.22em", color:cream },
  brandSub: { fontSize:9, letterSpacing:"0.3em", color:creamDim, textTransform:"uppercase", marginTop:2 },
  sessionLabel: { fontSize:8, letterSpacing:"0.35em", color:gold, textTransform:"uppercase", padding:"16px 20px 8px" },
  stageNav: { flex:1, padding:"6px 12px 16px", display:"flex", flexDirection:"column", gap:3 },
  stageRow: { display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:4, position:"relative", cursor:"default", transition:"all 0.2s" },
  stageRowActive: { background:inkMid, border:`1px solid ${borderWarm}` },
  stageRowDim: { opacity:0.2 },
  stageNum: { width:28, height:28, borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, letterSpacing:"0.1em", color:creamDim, border:`1px solid ${border}`, background:ink, flexShrink:0, fontWeight:700 },
  stageNumActive: { background:gold, border:`1px solid ${gold}`, color:ink, fontSize:10 },
  stageNumDone: { background:"#1C1810", border:`1px solid ${borderWarm}`, color:gold, fontSize:11 },
  stageBody: { flex:1, minWidth:0 },
  stageLabel: { fontSize:11.5, color:cream, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  stageSub: { fontSize:9, color:creamDim, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  activePulse: { width:7, height:7, borderRadius:"50%", background:gold, flexShrink:0 },
  sidebarBottom: { padding:"16px 20px 24px", borderTop:`1px solid ${border}` },
  quoteBlock: { display:"flex", gap:12, alignItems:"flex-start" },
  quoteBar: { width:2, minHeight:44, background:goldDeep, borderRadius:1, flexShrink:0, marginTop:2 },
  quoteText: { fontSize:10.5, color:creamDim, lineHeight:1.75, fontStyle:"italic" },
  main: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:ink },
  topBar: { padding:"13px 28px 11px", borderBottom:`1px solid ${border}`, display:"flex", alignItems:"center", gap:18, flexShrink:0 },
  topLeft: { display:"flex", alignItems:"center", gap:12, minWidth:220 },
  stageChip: { display:"flex", alignItems:"center", gap:6, fontSize:9, letterSpacing:"0.2em", color:gold, textTransform:"uppercase", border:`1px solid ${borderWarm}`, padding:"3px 8px", borderRadius:2 },
  chipDot: { width:5, height:5, borderRadius:"50%", background:gold, display:"inline-block" },
  topStageName: { fontSize:12, color:creamDim, fontStyle:"italic" },
  progressTrack: { flex:1, height:1, background:border, borderRadius:1, overflow:"hidden" },
  progressFill: { height:"100%", background:`linear-gradient(90deg,${goldDeep},${gold})`, borderRadius:1, transition:"width 0.9s cubic-bezier(0.4,0,0.2,1)" },
  exportBtn: { background:"transparent", border:`1px solid ${gold}`, color:gold, padding:"6px 14px", fontSize:9, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", borderRadius:2, cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" },
  splash: { flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 60px", overflow:"auto", gap:60 },
  splashInner: { maxWidth:480, flex:1 },
  splashEyebrow: { fontSize:8, letterSpacing:"0.35em", color:gold, textTransform:"uppercase", marginBottom:20 },
  splashTitle: { fontSize:36, fontWeight:400, color:cream, lineHeight:1.2, marginBottom:22, letterSpacing:"-0.01em" },
  splashEm: { fontStyle:"italic", color:gold },
  splashLead: { fontSize:14.5, color:creamMid, lineHeight:1.9, marginBottom:14 },
  splashLead2: { fontSize:13, color:creamDim, lineHeight:1.9, marginBottom:28, fontStyle:"italic" },
  splashFeatures: { marginBottom:32, display:"flex", flexDirection:"column", gap:10 },
  featureRow: { display:"flex", alignItems:"center", gap:12 },
  featureDot: { width:5, height:5, borderRadius:"50%", background:gold, flexShrink:0 },
  featureText: { fontSize:13, color:creamMid },
  startBtn: { background:gold, color:ink, border:"none", padding:"14px 38px", fontSize:10, fontWeight:700, letterSpacing:"0.2em", textTransform:"uppercase", borderRadius:2, cursor:"pointer", display:"block", marginBottom:16 },
  splashNote: { fontSize:10, color:creamDim, letterSpacing:"0.08em" },
  splashVisual: { width:240, height:240, position:"relative", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  ring1: { position:"absolute", borderRadius:"50%", width:240, height:240, border:`1px solid ${border}` },
  ring2: { position:"absolute", borderRadius:"50%", width:180, height:180, border:`1px solid ${borderWarm}` },
  ring3: { position:"absolute", borderRadius:"50%", width:120, height:120, border:`1px solid #3A3020` },
  centerGlyph: { position:"relative", zIndex:1 },
  chatArea: { flex:1, overflowY:"auto", padding:"28px 32px 16px", display:"flex", flexDirection:"column", gap:22 },
  msgRow: { display:"flex", alignItems:"flex-start", gap:12 },
  avatarDot: { flexShrink:0, marginTop:18 },
  bubble: { maxWidth:"70%", borderRadius:4, padding:"14px 18px", lineHeight:1.85 },
  bubbleAI: { background:inkLight, border:`1px solid ${border}`, borderRadius:"2px 8px 8px 8px" },
  bubbleUser: { background:"#181410", border:`1px solid ${borderWarm}`, borderRadius:"8px 2px 8px 8px" },
  guideLabel: { display:"block", fontSize:8, letterSpacing:"0.3em", color:gold, textTransform:"uppercase", marginBottom:9 },
  bubbleTxt: { fontSize:14, color:cream, margin:0, whiteSpace:"pre-wrap", lineHeight:1.85 },
  dots: { display:"flex", gap:5, alignItems:"center", height:20 },
  errBar: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", borderRadius:3, background:"#180C0C", border:"1px solid #4A1818", fontSize:12, color:"#C07070" },
  errX: { background:"none", border:"none", color:"#C07070", cursor:"pointer", fontSize:12, padding:0 },
  inputRow: { display:"flex", gap:10, padding:"12px 28px 22px", borderTop:`1px solid ${border}`, background:ink, alignItems:"flex-end", flexShrink:0 },
  ta: { flex:1, background:inkLight, border:`1px solid ${border}`, borderRadius:4, color:cream, fontFamily:"Palatino,'Book Antiqua',Georgia,serif", fontSize:14, lineHeight:1.7, padding:"11px 15px", resize:"none", outline:"none", transition:"border-color 0.2s" },
  sendBtn: { width:44, height:44, background:gold, color:ink, border:"none", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:24 },
  modal: { background:inkLight, border:`1px solid ${borderWarm}`, borderRadius:5, width:"100%", maxWidth:600, maxHeight:"82vh", display:"flex", flexDirection:"column", overflow:"hidden" },
  modalHead: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 22px", borderBottom:`1px solid ${border}`, flexShrink:0 },
  modalTitle: { fontSize:10, letterSpacing:"0.25em", color:gold, textTransform:"uppercase", display:"flex", alignItems:"center" },
  closeBtn: { background:"none", border:"none", color:creamDim, cursor:"pointer", fontSize:15, padding:0, lineHeight:1 },
  modalBody: { flex:1, overflowY:"auto", padding:"22px" },
  mapPre: { fontSize:13, color:cream, lineHeight:1.9, whiteSpace:"pre-wrap", fontFamily:"Palatino,'Book Antiqua',Georgia,serif", margin:0 },
  modalFoot: { display:"flex", gap:10, padding:"14px 22px", borderTop:`1px solid ${border}`, flexShrink:0 },
  goldBtn: { background:gold, color:ink, border:"none", padding:"9px 22px", fontSize:9, fontWeight:700, letterSpacing:"0.18em", textTransform:"uppercase", borderRadius:2, cursor:"pointer" },
  ghostBtn: { background:"transparent", color:creamDim, border:`1px solid ${border}`, padding:"9px 22px", fontSize:9, fontWeight:700, letterSpacing:"0.18em", textTransform:"uppercase", borderRadius:2, cursor:"pointer" },
};

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2A2318; border-radius: 2px; }
  .vc-input:focus { border-color: #E8C97A50 !important; box-shadow: 0 0 0 1px #E8C97A18; }
  .export-btn:hover { background: #E8C97A18 !important; }
  .start-btn:hover { background: #F0D890 !important; transform: translateY(-1px); transition: all 0.18s; }
  .send-btn:hover { background: #F0D890 !important; }
  .gold-btn:hover { background: #F0D890 !important; }
  .ghost-btn:hover { border-color: #E8C97A !important; color: #E8C97A !important; }
  .pulse-dot { animation: pulse-glow 2s ease-in-out infinite; }
  @keyframes pulse-glow { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
  .msg-in { animation: rise 0.35s cubic-bezier(0.22,1,0.36,1) both; }
  @keyframes rise { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .d { width:5px;height:5px;border-radius:50%;background:#E8C97A;display:inline-block;animation:breathe 1.2s ease-in-out infinite; }
  .d:nth-child(2){animation-delay:0.2s} .d:nth-child(3){animation-delay:0.4s}
  @keyframes breathe { 0%,80%,100%{transform:scale(0.5);opacity:0.2} 40%{transform:scale(1);opacity:1} }
  .chat-scroll { scroll-behavior: smooth; }
`;
