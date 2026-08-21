import { useEffect, useMemo, useRef, useState } from "react";

const COPY = "Great ideas begin when curious people keep typing with intention.";
const RACERS = [
  { name: "ALEX", color: "blue", wpm: 108, accuracy: 98 },
  { name: "TAYLOR", color: "red", wpm: 101, accuracy: 96 },
  { name: "JORDAN", color: "yellow", wpm: 86, accuracy: 94 },
];

function score(text, startedAt, errors) {
  const minutes = Math.max((Date.now() - startedAt) / 60000, 1 / 60000);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const accuracy = text.length ? Math.max(0, Math.round(((text.length - errors) / text.length) * 100)) : 100;
  return { wpm: Math.max(0, Math.round((words / minutes) * (accuracy / 100))), accuracy };
}

export function App() {
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [finished, setFinished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [font, setFont] = useState("clean");
  const inputRef = useRef(null);
  const current = useMemo(() => startedAt ? score(typed, startedAt, errors) : { wpm: 0, accuracy: 100 }, [typed, startedAt, errors]);
  const progress = Math.min(100, (typed.length / COPY.length) * 100);
  const racers = RACERS.map((racer, index) => ({ ...racer, progress: Math.min(94, progress * (0.72 + index * 0.08) + 22 - index * 10) }));

  useEffect(() => {
    function shortcut(event) { if (event.key === "Escape" || (event.key === " " && finished)) restart(); }
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  });
  function begin() { if (!startedAt) setStartedAt(Date.now()); inputRef.current?.focus(); }
  function type(event) {
    const next = event.target.value; if (!startedAt) setStartedAt(Date.now());
    const last = next.length - 1; if (next.length > typed.length && next[last] !== COPY[last]) setErrors((value) => value + 1);
    setTyped(next.slice(0, COPY.length));
    if (next.length >= COPY.length) { setFinished(true); setUnlocked(true); inputRef.current?.blur(); }
  }
  function restart() { setTyped(""); setErrors(0); setStartedAt(null); setFinished(false); requestAnimationFrame(() => inputRef.current?.focus()); }
  async function shareRoom() {
    try { await navigator.clipboard.writeText(`${window.location.href.split("#")[0]}#race-with-friends`); } catch { /* confirmation remains visible */ }
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }
  return <main className={`app font-${font}`} onClick={begin}>
    <header><div className="brand">TYPE RACE <span>/</span> FRIENDS</div><div className="header-actions"><button className="text-button" onClick={(event) => { event.stopPropagation(); shareRoom(); }}>{copied ? "LINK COPIED" : "INVITE FRIENDS"}</button><div className="race-length">RACE LENGTH <strong>60 SEC</strong></div></div></header>
    <section className="raceboard" aria-label="Friend race standings"><div className="racer you"><span>YOU</span><div><i style={{ width: `${progress}%` }} /></div><b>{current.wpm || "—"} WPM</b><em>{current.accuracy}%</em></div>{racers.map((racer) => <div className={`racer ${racer.color}`} key={racer.name}><span>{racer.name}</span><div><i style={{ width: `${racer.progress}%` }} /></div><b>{racer.wpm} WPM</b><em>{racer.accuracy}%</em></div>)}</section>
    <section className="typing-zone" aria-label="Typing challenge"><p className="eyebrow">{finished ? "RACE COMPLETE" : startedAt ? "TYPE THE LINE" : "PRESS ANY KEY TO START"}</p><div className="copy" aria-hidden="true">{COPY.split("").map((letter, index) => { const state = index < typed.length ? (typed[index] === letter ? "correct" : "wrong") : index === typed.length ? "cursor" : "future"; return <span key={`${letter}-${index}`} className={state}>{letter}</span>; })}</div><input ref={inputRef} className="typing-input" value={typed} onChange={type} onFocus={begin} aria-label="Type the displayed sentence" autoComplete="off" autoCapitalize="off" spellCheck="false" /><p className="quiet">Accuracy creates speed. Backspace is allowed.</p></section>
    <footer><div className="metric"><small>WPM</small><strong>{current.wpm || "—"}</strong><span>WORDS PER MINUTE</span></div><div className="metric"><small>ACCURACY</small><strong>{current.accuracy}%</strong><span>PRECISION</span></div><div className="metric"><small>RHYTHM</small><strong>{startedAt ? `${Math.max(0, 93 - errors * 4)}%` : "—"}</strong><span>STEADY FLOW</span></div><div className="metric action-metric">{finished ? <><small>NEW FONT UNLOCKED</small><strong className="unlock">DISPLAY</strong><span>CHOOSE IT ABOVE</span></> : <><small>RACE IN PROGRESS</small><button onClick={(event) => { event.stopPropagation(); restart(); }}>RESTART <span>↗</span></button><span>ESC TO RESET</span></>}</div></footer>
    {unlocked && <aside className="font-picker" aria-label="Unlocked fonts"><span>TYPEFACE</span><button className={font === "clean" ? "active" : ""} onClick={() => setFont("clean")}>CLEAN</button><button className={font === "display" ? "active" : ""} onClick={() => setFont("display")}>DISPLAY</button></aside>}
  </main>;
}
