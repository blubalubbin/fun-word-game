import { useEffect, useMemo, useRef, useState } from "react";
import { Peer } from "peerjs";

const COPY = "Great ideas begin when curious people keep typing with intention.";
const MAX_FRIENDS = 3;
const LANE_COLORS = ["blue", "red", "yellow"];

function score(text, startedAt, errors) {
  const minutes = Math.max((Date.now() - startedAt) / 60000, 1 / 60000);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const attempts = text.length + errors;
  const accuracy = attempts ? Math.round((text.length / attempts) * 100) : 100;
  return { wpm: Math.max(0, Math.round((words / minutes) * (accuracy / 100))), accuracy };
}

function blankFriend(index) {
  return { id: `waiting-${index}`, name: "WAITING…", progress: 0, wpm: "—", accuracy: "—", waiting: true };
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
    const guests = [...connectionsRef.current.values()].map(({ id, name, state }) => ({ id, name, ...state }));
    return [{ id: "host", name: "HOST", ...localStateRef.current }, ...guests];
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
          connection,
          state: { progress: 0, wpm: 0, accuracy: 100, finished: false },
        });
        connection.send({ type: "welcome", selfId: connection.peer });
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

  return <main className={`app font-${font}`} onClick={begin}>
    <header><div className="brand">TYPE RACE <span>/</span> FRIENDS</div><div className="header-actions"><button className="text-button" data-invite-url={inviteUrl || undefined} onClick={(event) => { event.stopPropagation(); shareRoom(); }}>{copied ? "LINK COPIED" : roomId ? "COPY ROOM LINK" : "INVITE FRIENDS"}</button><div className="race-length">{roomStatus}</div></div></header>
    <section className="raceboard" aria-label="Friend race standings"><div className="racer you"><span>YOU</span><div><i style={{ width: `${progress}%` }} /></div><b>{current.wpm || "—"} WPM</b><em>{current.accuracy}%</em></div>{visibleFriends.map((racer, index) => <div className={`racer ${LANE_COLORS[index]} ${racer.waiting ? "waiting" : ""}`} key={racer.id}><span>{racer.name}</span><div><i style={{ width: `${racer.progress}%` }} /></div><b>{racer.wpm || "—"} WPM</b><em>{racer.accuracy === "—" ? "—" : `${racer.accuracy}%`}</em></div>)}</section>
    <section className="typing-zone" aria-label="Typing challenge"><p className="eyebrow">{finished ? "RACE COMPLETE" : startedAt ? "TYPE THE LINE" : "PRESS ANY KEY TO START"}</p><div className="copy" aria-hidden="true">{COPY.split("").map((letter, index) => { const state = index < typed.length ? "correct" : index === typed.length ? "cursor" : "future"; return <span key={`${letter}-${index}`} className={state}>{letter}</span>; })}</div><input ref={inputRef} className="typing-input" value={typed} onChange={type} onFocus={begin} aria-label="Type the displayed sentence" autoComplete="off" autoCapitalize="off" spellCheck="false" /><p className="quiet">Only the correct key moves you forward. Mistakes stay in place—no backspace needed.</p></section>
    <footer><div className="metric"><small>WPM</small><strong>{current.wpm || "—"}</strong><span>WORDS PER MINUTE</span></div><div className="metric"><small>ACCURACY</small><strong>{current.accuracy}%</strong><span>PRECISION</span></div><div className="metric"><small>RHYTHM</small><strong>{startedAt ? `${Math.max(0, 93 - errors * 4)}%` : "—"}</strong><span>STEADY FLOW</span></div><div className="metric action-metric">{finished ? <><small>NEW FONT UNLOCKED</small><strong className="unlock">DISPLAY</strong><span>CHOOSE IT ABOVE</span></> : <><small>RACE IN PROGRESS</small><button onClick={(event) => { event.stopPropagation(); restart(); }}>RESTART <span>↗</span></button><span>ESC TO RESET</span></>}</div></footer>
    {unlocked && <aside className="font-picker" aria-label="Unlocked fonts"><span>TYPEFACE</span><button className={font === "clean" ? "active" : ""} onClick={() => setFont("clean")}>CLEAN</button><button className={font === "display" ? "active" : ""} onClick={() => setFont("display")}>DISPLAY</button></aside>}
  </main>;
}
