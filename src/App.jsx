import { useEffect, useMemo, useRef, useState } from "react";
import { Peer } from "peerjs";

const COPY = "Great ideas begin when curious people keep typing with intention.";
const MAX_FRIENDS = 3;
const PLAYER_COLORS = ["#00aeef", "#ec008c", "#fff200", "#111111"];

function hexToHsv(hex) {
  const [r, g, b] = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  return { h: ((hue * 60) + 360) % 360, s: max ? delta / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
  const chroma = v * s;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [r1, g1, b1] = section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0] : section < 3 ? [0, chroma, x] : section < 4 ? [0, x, chroma] : section < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = v - chroma;
  return `#${[r1, g1, b1].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function mixHsv(colors) {
  if (colors.length === 1) return colors[0];
  const values = colors.map(hexToHsv);
  const radians = values.map(({ h }) => h * Math.PI / 180);
  const hue = (Math.atan2(radians.reduce((sum, angle) => sum + Math.sin(angle), 0), radians.reduce((sum, angle) => sum + Math.cos(angle), 0)) * 180 / Math.PI + 360) % 360;
  return hsvToHex({ h: hue, s: values.reduce((sum, color) => sum + color.s, 0) / values.length, v: values.reduce((sum, color) => sum + color.v, 0) / values.length });
}

function mixCmyk(colors) {
  if (colors.length === 1) return colors[0];
  const inks = colors.map((color) => {
    const [r, g, b] = color.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255);
    const k = 1 - Math.max(r, g, b);
    const scale = 1 - k;
    return { c: scale ? (1 - r - k) / scale : 0, m: scale ? (1 - g - k) / scale : 0, y: scale ? (1 - b - k) / scale : 0, k };
  });
  const combined = inks.reduce((result, ink) => ({
    c: Math.max(result.c, ink.c), m: Math.max(result.m, ink.m), y: Math.max(result.y, ink.y), k: Math.max(result.k, ink.k),
  }), { c: 0, m: 0, y: 0, k: 0 });
  const channel = (ink) => Math.round(255 * (1 - ink) * (1 - combined.k)).toString(16).padStart(2, "0");
  return `#${channel(combined.c)}${channel(combined.m)}${channel(combined.y)}`;
}

function contrastColor(hex) {
  const [r, g, b] = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16));
  return ((r * 299) + (g * 587) + (b * 114)) / 1000 > 150 ? "#111111" : "#ffffff";
}

function score(text, startedAt, errors) {
  const minutes = Math.max((Date.now() - startedAt) / 60000, 1 / 60000);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const attempts = text.length + errors;
  const accuracy = attempts ? Math.round((text.length / attempts) * 100) : 100;
  return { wpm: Math.max(0, Math.round((words / minutes) * (accuracy / 100))), accuracy };
}

function blankFriend(index) {
  return { id: `waiting-${index}`, name: "WAITING…", progress: 0, wpm: "—", accuracy: "—", color: PLAYER_COLORS[index + 1], waiting: true };
}

export function App() {
  const roomId = useMemo(() => new URLSearchParams(window.location.search).get("room"), []);
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [finished, setFinished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [font, setFont] = useState("clean");
  const [friends, setFriends] = useState([]);
  const [inviteUrl, setInviteUrl] = useState(roomId ? window.location.href : "");
  const [roomStatus, setRoomStatus] = useState(roomId ? "JOINING ROOM" : "READY TO HOST");
  const [selfColor, setSelfColor] = useState(PLAYER_COLORS[0]);
  const inputRef = useRef(null);
  const peerRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const selfIdRef = useRef("host");
  const hostRef = useRef(!roomId);
  const current = useMemo(() => startedAt ? score(typed, startedAt, errors) : { wpm: 0, accuracy: 100 }, [typed, startedAt, errors]);
  const progress = Math.min(100, (typed.length / COPY.length) * 100);
  const localStateRef = useRef({ progress: 0, wpm: 0, accuracy: 100, finished: false });
  localStateRef.current = { progress, wpm: current.wpm, accuracy: current.accuracy, finished };

  function hostRoster() {
    const guests = [...connectionsRef.current.values()].map(({ id, name, color, state }) => ({ id, name, color, ...state }));
    return [{ id: "host", name: "HOST", color: PLAYER_COLORS[0], ...localStateRef.current }, ...guests];
  }

  function broadcastRoster() {
    if (!hostRef.current) return;
    const roster = hostRoster();
    setFriends(roster.slice(1));
    connectionsRef.current.forEach(({ connection }) => {
      if (connection.open) connection.send({ type: "roster", roster });
    });
  }

  function attachConnection(connection, isHost) {
    connection.on("open", () => {
      if (isHost) {
        if (connectionsRef.current.size >= MAX_FRIENDS) {
          connection.send({ type: "full" });
          connection.close();
          return;
        }
        const used = new Set([...connectionsRef.current.values()].map((friend) => friend.slot));
        const slot = [1, 2, 3].find((candidate) => !used.has(candidate));
        connectionsRef.current.set(connection.peer, {
          id: connection.peer,
          slot,
          name: `FRIEND ${slot}`,
          color: PLAYER_COLORS[slot],
          connection,
          state: { progress: 0, wpm: 0, accuracy: 100, finished: false },
        });
        connection.send({ type: "welcome", selfId: connection.peer, color: PLAYER_COLORS[slot] });
        const count = connectionsRef.current.size;
        setRoomStatus(`${count} FRIEND${count === 1 ? "" : "S"} CONNECTED`);
        broadcastRoster();
      } else {
        setRoomStatus("CONNECTED");
        connection.send({ type: "state", state: localStateRef.current });
      }
    });

    connection.on("data", (message) => {
      if (!message || typeof message !== "object") return;
      if (isHost && message.type === "state") {
        const friend = connectionsRef.current.get(connection.peer);
        if (friend) {
          friend.state = message.state;
          broadcastRoster();
        }
      } else if (!isHost && message.type === "welcome") {
        selfIdRef.current = message.selfId;
        setSelfColor(message.color);
      } else if (!isHost && message.type === "roster") {
        setFriends(message.roster.filter((racer) => racer.id !== selfIdRef.current));
      } else if (!isHost && message.type === "full") {
        setRoomStatus("ROOM IS FULL");
      }
    });

    connection.on("close", () => {
      if (isHost) {
        connectionsRef.current.delete(connection.peer);
        const count = connectionsRef.current.size;
        setRoomStatus(count ? `${count} FRIEND${count === 1 ? "" : "S"} CONNECTED` : "ROOM OPEN");
        broadcastRoster();
      } else {
        setRoomStatus("HOST DISCONNECTED");
      }
    });
  }

  function createPeer(asHost) {
    if (peerRef.current) return peerRef.current;
    hostRef.current = asHost;
    const peer = new Peer();
    peerRef.current = peer;
    peer.on("connection", (connection) => attachConnection(connection, true));
    peer.on("error", (error) => {
      setRoomStatus(error.type === "peer-unavailable" ? "ROOM NOT FOUND" : "CONNECTION FAILED");
    });
    return peer;
  }

  useEffect(() => {
    if (!roomId) return undefined;
    const peer = createPeer(false);
    peer.on("open", () => {
      const connection = peer.connect(roomId, { reliable: true });
      connectionsRef.current.set(roomId, { connection });
      attachConnection(connection, false);
    });
    return undefined;
  }, [roomId]);

  useEffect(() => () => {
    peerRef.current?.destroy();
    peerRef.current = null;
    connectionsRef.current.clear();
  }, []);

  useEffect(() => {
    if (hostRef.current) {
      broadcastRoster();
    } else {
      const host = connectionsRef.current.get(roomId)?.connection;
      if (host?.open) host.send({ type: "state", state: localStateRef.current });
    }
  }, [progress, current.wpm, current.accuracy, finished, roomId]);

  useEffect(() => {
    function shortcut(event) {
      if (event.key === "Escape" || (event.key === " " && finished)) restart();
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  function begin() {
    inputRef.current?.focus();
  }

  function type(event) {
    if (finished) return;
    const proposed = event.target.value;
    if (proposed.length <= typed.length) return;
    if (!startedAt) setStartedAt(Date.now());

    let accepted = typed;
    let rejected = 0;
    for (const character of proposed.slice(typed.length)) {
      if (character === COPY[accepted.length]) {
        accepted += character;
      } else {
        rejected += 1;
        break;
      }
    }
    if (rejected) setErrors((value) => value + rejected);
    setTyped(accepted);
    if (accepted.length === COPY.length) {
      setFinished(true);
      setUnlocked(true);
      inputRef.current?.blur();
    }
  }

  function restart() {
    setTyped("");
    setErrors(0);
    setStartedAt(null);
    setFinished(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function shareRoom() {
    let inviteUrl = window.location.href;
    if (!roomId) {
      setRoomStatus("OPENING ROOM");
      const peer = createPeer(true);
      try {
        const peerId = peer.open ? peer.id : await new Promise((resolve, reject) => {
          peer.once("open", resolve);
          peer.once("error", reject);
        });
        const url = new URL(window.location.href);
        url.searchParams.set("room", peerId);
        inviteUrl = url.toString();
        setInviteUrl(inviteUrl);
        setRoomStatus(connectionsRef.current.size ? `${connectionsRef.current.size} FRIENDS CONNECTED` : "ROOM OPEN");
      } catch {
        setRoomStatus("CONNECTION FAILED");
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this race link:", inviteUrl);
    }
  }

  const visibleFriends = [...friends.slice(0, MAX_FRIENDS)];
  while (visibleFriends.length < MAX_FRIENDS) visibleFriends.push(blankFriend(visibleFriends.length));

  const positions = new Map();
  const completedBy = new Map();
  function addPosition(index, color, name) {
    const position = Math.min(COPY.length - 1, Math.max(0, index));
    positions.set(position, [...(positions.get(position) || []), { color, name }]);
  }
  addPosition(typed.length, selfColor, "YOU");
  friends.filter((friend) => !friend.waiting).forEach((friend) => addPosition(Math.round((friend.progress / 100) * COPY.length), friend.color, friend.name));
  const racers = [
    { count: typed.length, color: selfColor },
    ...friends.filter((friend) => !friend.waiting).map((friend) => ({ count: Math.round((friend.progress / 100) * COPY.length), color: friend.color })),
  ];
  COPY.split("").forEach((_, index) => {
    const colors = racers.filter((racer) => index < racer.count).map((racer) => racer.color);
    if (colors.length) completedBy.set(index, mixCmyk(colors));
  });

  return <main className={`app font-${font}`} onClick={begin}>
    <header><div className="brand">TYPE RACE <span>/</span> FRIENDS</div><div className="header-actions"><button className="text-button" data-invite-url={inviteUrl || undefined} onClick={(event) => { event.stopPropagation(); shareRoom(); }}>{copied ? "LINK COPIED" : roomId ? "COPY ROOM LINK" : "INVITE FRIENDS"}</button><div className="race-length">{roomStatus}</div></div></header>
    <section className="raceboard" aria-label="Friend race standings"><div className="racer you" style={{ "--lane": selfColor }}><span>YOU</span><div><i style={{ width: `${progress}%` }} /></div><b>{current.wpm || "—"} WPM</b><em>{current.accuracy}%</em></div>{visibleFriends.map((racer) => <div className={`racer ${racer.waiting ? "waiting" : ""}`} style={{ "--lane": racer.color }} key={racer.id}><span>{racer.name}</span><div><i style={{ width: `${racer.progress}%` }} /></div><b>{racer.wpm || "—"} WPM</b><em>{racer.accuracy === "—" ? "—" : `${racer.accuracy}%`}</em></div>)}</section>
    <section className="typing-zone" aria-label="Typing challenge"><p className="eyebrow">{finished ? "RACE COMPLETE" : startedAt ? "TYPE THE LINE" : "PRESS ANY KEY TO START"}</p><div className="copy" aria-hidden="true">{COPY.split("").map((letter, index) => { const racersHere = positions.get(index) || []; const completedColor = completedBy.get(index); const positionColor = racersHere.length ? mixHsv(racersHere.map(({ color }) => color)) : null; const classes = [completedColor ? "completed" : "future"]; if (index === typed.length) classes.push("target"); if (index === typed.length - 1) classes.push("caret"); if (index === 0 && typed.length === 0) classes.push("cursor-start"); if (racersHere.length) classes.push("player-position"); if (racersHere.length > 1) classes.push("overlap"); return <span key={`${letter}-${index}`} className={classes.join(" ")} data-racers-here={racersHere.map(({ name }) => name).join(", ") || undefined} style={{ ...(completedColor ? { "--completed-color": completedColor } : {}), ...(positionColor ? { "--position-color": positionColor, "--position-contrast": contrastColor(positionColor) } : {}) }}>{letter}</span>; })}</div><input ref={inputRef} className="typing-input" value={typed} onChange={type} onFocus={begin} aria-label="Type the displayed sentence" autoComplete="off" autoCapitalize="sentences" autoCorrect="off" inputMode="text" enterKeyHint="done" spellCheck="false" /><p className="quiet">Only the correct key moves you forward. Mistakes stay in place—no backspace needed.</p></section>
    <footer><div className="metric"><small>WPM</small><strong>{current.wpm || "—"}</strong><span>WORDS PER MINUTE</span></div><div className="metric"><small>ACCURACY</small><strong>{current.accuracy}%</strong><span>PRECISION</span></div><div className="metric"><small>RHYTHM</small><strong>{startedAt ? `${Math.max(0, 93 - errors * 4)}%` : "—"}</strong><span>STEADY FLOW</span></div><div className="metric action-metric">{finished ? <><small>NEW FONT UNLOCKED</small><strong className="unlock">DISPLAY</strong><span>CHOOSE IT ABOVE</span></> : <><small>RACE IN PROGRESS</small><button onClick={(event) => { event.stopPropagation(); restart(); }}>RESTART <span>↗</span></button><span>ESC TO RESET</span></>}</div></footer>
    {unlocked && <aside className="font-picker" aria-label="Unlocked fonts"><span>TYPEFACE</span><button className={font === "clean" ? "active" : ""} onClick={() => setFont("clean")}>CLEAN</button><button className={font === "display" ? "active" : ""} onClick={() => setFont("display")}>DISPLAY</button></aside>}
  </main>;
}
