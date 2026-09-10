import React, { useState } from "react";

type Mode = "Drive" | "Transit" | "Bike" | "Walk";

const modes: Array<{ label: Mode; glyph: string }> = [
  { label: "Drive", glyph: "↗" },
  { label: "Transit", glyph: "▥" },
  { label: "Bike", glyph: "◌" },
  { label: "Walk", glyph: "↝" },
];

const stops = [
  { time: "08:32", title: "Pearl Street Mall", detail: "Start · 1.3 mi east", color: "#f0b86b" },
  { time: "08:47", title: "Baseline Rd & 30th", detail: "Turn south · 11 min", color: "#72d1bd" },
  { time: "09:04", title: "Boulder Junction", detail: "Arrive · 4.8 mi total", color: "#97b7ff" },
];

export default function BoulderMoveDarkContrast() {
  const [mode, setMode] = useState<Mode>("Transit");
  const [showContrast, setShowContrast] = useState(true);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <div className="bm-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        .bm-shell{--ink:#f5f4ee;--muted:#aab3b0;--quiet:#747f7e;--bg:#111817;--panel:#18211f;--panel2:#202b28;--line:#34423e;--teal:#76ddc4;--amber:#f0b86b;--blue:#97b7ff;min-height:100vh;background:radial-gradient(circle at 74% 4%,#263935 0,transparent 32%),#111817;color:var(--ink);font-family:'DM Sans',sans-serif;letter-spacing:-.01em;overflow:hidden}
        .bm-shell *{box-sizing:border-box}.bm-wrap{max-width:1440px;margin:auto;padding:24px 34px 38px}.bm-top{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:21px}.bm-brand{display:flex;gap:11px;align-items:center}.bm-logo{display:grid;place-items:center;width:34px;height:34px;border:1px solid #6bd0bb;border-radius:10px;color:var(--teal);font-size:22px;font-weight:700}.bm-word{font-weight:700;font-size:18px;letter-spacing:-.04em}.bm-word small{display:block;margin-top:2px;color:var(--quiet);font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-family:'Space Mono',monospace}.bm-nav{display:flex;align-items:center;gap:28px;color:var(--muted);font-size:13px}.bm-nav a{color:inherit;text-decoration:none}.bm-nav a:first-child{color:var(--ink)}.bm-theme{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:12px}.bm-toggle{width:38px;height:21px;padding:3px;border:1px solid #58716a;border-radius:20px;background:#2e403a;cursor:pointer;text-align:left}.bm-toggle span{display:block;width:13px;height:13px;background:var(--teal);border-radius:50%;margin-left:14px}
        .bm-kicker{display:flex;justify-content:space-between;align-items:flex-end;margin:42px 0 25px}.bm-kicker h1{font-size:34px;line-height:1.04;letter-spacing:-.055em;margin:0;font-weight:600}.bm-kicker p{margin:10px 0 0;color:var(--muted);font-size:14px}.bm-date{font:11px 'Space Mono',monospace;color:var(--quiet);letter-spacing:.08em}
        .bm-grid{display:grid;grid-template-columns:320px minmax(400px,1fr) 285px;gap:15px;align-items:start}.bm-card{background:rgba(24,33,31,.94);border:1px solid var(--line);border-radius:14px}.bm-card-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:19px;color:var(--ink);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.11em}.bm-card-title span{color:var(--quiet);font:10px 'Space Mono',monospace;text-transform:none;letter-spacing:0}
        .bm-planner{padding:21px}.bm-field{margin-bottom:11px}.bm-label{display:block;color:var(--quiet);font:10px 'Space Mono',monospace;text-transform:uppercase;letter-spacing:.12em;margin:0 0 7px}.bm-input{width:100%;height:44px;padding:0 12px;border:1px solid #43514e;border-radius:8px;background:#111918;color:var(--ink);font:13px 'DM Sans',sans-serif;outline:0}.bm-input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(118,221,196,.13)}.bm-swap{width:100%;border:0;background:transparent;color:var(--teal);font-size:11px;text-align:right;cursor:pointer;margin:-3px 0 11px}.bm-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:4px;background:#111918;border:1px solid var(--line);border-radius:9px}.bm-mode{height:34px;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;font-size:11px}.bm-mode b{display:block;font-size:15px;font-weight:400;line-height:12px;margin-bottom:3px}.bm-mode.active{background:#2c4e46;color:var(--teal);box-shadow:inset 0 0 0 1px #427b6b}.bm-plan{width:100%;height:44px;margin-top:18px;border:0;border-radius:8px;background:var(--teal);color:#12231f;font-weight:700;font-size:13px;cursor:pointer}.bm-plan:hover{background:#a2eddb}.bm-advanced{display:flex;justify-content:space-between;width:100%;padding:16px 0 0;margin-top:15px;border:0;border-top:1px solid var(--line);background:transparent;color:var(--muted);font-size:12px;cursor:pointer}.bm-status{display:flex;gap:8px;align-items:center;margin-top:19px;padding:11px;border-radius:8px;background:#202e2a;color:#a6cfc2;font-size:11px;line-height:1.35}.bm-dot{width:7px;height:7px;flex:none;border-radius:50%;background:var(--teal);box-shadow:0 0 0 4px rgba(118,221,196,.11)}
        .bm-map-card{padding:0;overflow:hidden}.bm-map-head{height:65px;display:flex;align-items:center;justify-content:space-between;padding:0 19px;border-bottom:1px solid var(--line)}.bm-map-head h2{margin:0;font-size:14px;font-weight:600}.bm-map-head p{margin:4px 0 0;color:var(--muted);font-size:11px}.bm-map-legend{display:flex;gap:12px;color:var(--muted);font-size:10px}.bm-legend{display:flex;gap:5px;align-items:center}.bm-legend i{width:8px;height:8px;border-radius:50%;display:inline-block}.bm-map{position:relative;height:475px;background-color:#1c2825;background-image:linear-gradient(28deg,transparent 48%,rgba(130,163,151,.09) 49%,rgba(130,163,151,.09) 50%,transparent 51%),linear-gradient(118deg,transparent 48%,rgba(130,163,151,.07) 49%,rgba(130,163,151,.07) 50%,transparent 51%),linear-gradient(90deg,transparent 49.5%,rgba(130,163,151,.05) 50%,transparent 50.5%);background-size:180px 140px,230px 170px,100px 100px}.bm-map:before,.bm-map:after{content:'';position:absolute;inset:38px 12%;border:1px solid rgba(152,188,172,.12);transform:rotate(-18deg);border-radius:50% 42% 55% 43%}.bm-map:after{inset:130px 3% 28px 30%;transform:rotate(24deg);border-radius:45% 60% 35% 65%}.bm-road{position:absolute;height:5px;background:#416057;border-radius:9px;transform-origin:left center;opacity:.75}.bm-road.r1{width:67%;top:48%;left:2%;transform:rotate(-11deg)}.bm-road.r2{width:53%;top:29%;left:34%;transform:rotate(44deg)}.bm-road.r3{width:54%;top:74%;left:22%;transform:rotate(-37deg)}.bm-road.r4{width:68%;top:60%;left:32%;transform:rotate(17deg)}.bm-route{position:absolute;left:15%;top:63%;width:67%;height:4px;background:var(--teal);transform:rotate(-17deg);box-shadow:0 0 0 1px rgba(118,221,196,.2),0 0 18px rgba(118,221,196,.25)}.bm-route:after{content:'';position:absolute;right:0;top:-4px;border-left:9px solid var(--teal);border-top:6px solid transparent;border-bottom:6px solid transparent}.bm-pin{position:absolute;display:grid;place-items:center;width:29px;height:29px;border:2px solid #15221f;border-radius:50%;color:#15221f;font:700 11px 'Space Mono',monospace;z-index:2}.bm-pin.start{left:13%;top:59%;background:var(--amber)}.bm-pin.end{right:16%;top:26%;background:var(--teal)}.bm-map-tag{position:absolute;left:14%;top:69%;padding:5px 8px;background:#172320;border:1px solid #416057;color:var(--ink);border-radius:5px;font-size:10px}.bm-map-tag.end{left:auto;right:10%;top:20%}.bm-scale{position:absolute;left:18px;bottom:17px;color:var(--muted);font:10px 'Space Mono',monospace}.bm-attrib{position:absolute;right:16px;bottom:17px;color:#60746c;font-size:9px}
        .bm-side{display:grid;gap:15px}.bm-trip{padding:19px}.bm-trip-score{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:3px}.bm-trip-score strong{font-size:31px;line-height:1;font-weight:500;letter-spacing:-.07em}.bm-trip-score strong small{font-size:14px;letter-spacing:0;color:var(--muted)}.bm-confidence{padding:5px 7px;border:1px solid #557568;border-radius:5px;color:var(--teal);font:10px 'Space Mono',monospace}.bm-trip-row{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid #2a3734}.bm-trip-row:last-child{border-bottom:0}.bm-time{width:43px;color:var(--muted);font:10px 'Space Mono',monospace;padding-top:2px}.bm-node{position:relative;padding-left:18px}.bm-node:before{content:'';position:absolute;left:0;top:4px;width:7px;height:7px;border:2px solid var(--teal);background:var(--panel);border-radius:50%}.bm-node strong{display:block;font-size:12px;font-weight:600}.bm-node span{display:block;margin-top:3px;color:var(--muted);font-size:10px}.bm-weather{padding:19px}.bm-temp{display:flex;justify-content:space-between;align-items:center}.bm-temp strong{font-size:34px;letter-spacing:-.07em;font-weight:500}.bm-temp span{color:var(--amber);font-size:25px}.bm-weather p{color:var(--muted);font-size:11px;margin:5px 0 14px}.bm-weather-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.bm-weather-grid div{padding:8px 7px;background:#202b28;border-radius:6px}.bm-weather-grid b{display:block;color:var(--ink);font:10px 'Space Mono',monospace}.bm-weather-grid span{display:block;color:var(--muted);font-size:10px;margin-top:4px}
        .bm-contrast{margin-top:18px;padding:14px 15px;border:1px solid #765a34;border-radius:10px;background:#2a241c}.bm-contrast-head{display:flex;justify-content:space-between;align-items:center}.bm-contrast h3{margin:0;color:#f4d29e;font-size:11px;text-transform:uppercase;letter-spacing:.09em}.bm-close{background:transparent;color:#b9a98f;border:0;cursor:pointer;font-size:15px}.bm-contrast p{margin:9px 0 12px;color:#d9c5a7;font-size:11px;line-height:1.45}.bm-meter{height:6px;background:#574a38;border-radius:9px;overflow:hidden}.bm-meter i{display:block;height:100%;width:92%;background:var(--teal);border-radius:9px}.bm-meter-label{display:flex;justify-content:space-between;margin-top:7px;color:#b9a98f;font:9px 'Space Mono',monospace}.bm-footer{display:flex;justify-content:space-between;align-items:center;margin-top:17px;color:var(--quiet);font:10px 'Space Mono',monospace}.bm-footer button{border:1px solid #496158;border-radius:6px;background:transparent;padding:7px 9px;color:var(--teal);cursor:pointer;font:10px 'Space Mono',monospace}.bm-notice{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:10px 13px;border:1px solid #52776b;border-radius:7px;background:#213833;color:var(--teal);font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
        @media(max-width:1050px){.bm-grid{grid-template-columns:280px minmax(350px,1fr)}.bm-side{grid-column:1/-1;grid-template-columns:1fr 1fr}.bm-map{height:420px}}@media(max-width:720px){.bm-wrap{padding:18px 15px 30px}.bm-nav{display:none}.bm-kicker{margin-top:28px}.bm-kicker h1{font-size:28px}.bm-date{font-size:9px}.bm-grid{display:flex;flex-direction:column}.bm-planner,.bm-map-card,.bm-side{width:100%}.bm-map{height:330px}.bm-side{display:grid;grid-template-columns:1fr}.bm-theme{font-size:0}.bm-theme .bm-toggle{font-size:initial}.bm-map-legend{gap:7px}.bm-footer{gap:10px;align-items:flex-start;line-height:1.4}}
      `}</style>
      <div className="bm-wrap">
        <header className="bm-top">
          <div className="bm-brand">
            <div className="bm-logo" aria-hidden="true">B</div>
            <div className="bm-word">BoulderMove<small>Plan the way there</small></div>
          </div>
          <nav className="bm-nav" aria-label="Primary navigation"><a href="#plan">Plan a trip</a><a href="#saved">Saved trips</a><a href="#about">About Boulder</a></nav>
          <div className="bm-theme"><span>Dark contrast</span><button className="bm-toggle" aria-label="Dark mode enabled"><span /></button></div>
        </header>

        <div className="bm-kicker">
          <div><h1>Good morning,<br /><span style={{ color: "var(--teal)" }}>Boulder.</span></h1><p>Make the next move with a route that fits your day.</p></div>
          <div className="bm-date">TUESDAY · 18 JUNE 2024</div>
        </div>

        <main className="bm-grid">
          <section className="bm-card bm-planner" id="plan">
            <div className="bm-card-title">Trip setup <span>01 / 03</span></div>
            <div className="bm-field"><label className="bm-label" htmlFor="from">Leaving from</label><input id="from" className="bm-input" defaultValue="Pearl Street Mall" /></div>
            <button className="bm-swap" onClick={() => announce("Origin and destination swapped")}>Swap locations ↕</button>
            <div className="bm-field"><label className="bm-label" htmlFor="to">Going to</label><input id="to" className="bm-input" defaultValue="Boulder Junction" /></div>
            <div className="bm-field"><label className="bm-label">Travel by</label><div className="bm-modes">{modes.map((item) => <button key={item.label} className={`bm-mode ${mode === item.label ? "active" : ""}`} onClick={() => { setMode(item.label); announce(`${item.label} selected`); }} aria-pressed={mode === item.label}><b>{item.glyph}</b>{item.label}</button>)}</div></div>
            <button className="bm-plan" onClick={() => announce("Fresh route planned for 08:32")}>Plan my trip <span aria-hidden="true">→</span></button>
            <button className="bm-advanced" onClick={() => announce("Advanced options opened")}><span>Advanced options</span><span>＋</span></button>
            <div className="bm-status"><i className="bm-dot" /><span>Live conditions checked<br /><b style={{ color: "var(--ink)" }}>No service alerts in Boulder</b></span></div>
          </section>

          <section className="bm-card bm-map-card">
            <div className="bm-map-head"><div><h2>Recommended route</h2><p>Updated just now · Moderate traffic</p></div><div className="bm-map-legend"><span className="bm-legend"><i style={{ background: "var(--teal)" }} />Your route</span><span className="bm-legend"><i style={{ background: "var(--amber)" }} />Start</span></div></div>
            <div className="bm-map" aria-label="Stylized map of Boulder route">
              <div className="bm-road r1" /><div className="bm-road r2" /><div className="bm-road r3" /><div className="bm-road r4" /><div className="bm-route" />
              <div className="bm-pin start">A</div><div className="bm-pin end">B</div><div className="bm-map-tag">Pearl Street</div><div className="bm-map-tag end">Boulder Junction</div><div className="bm-scale">1 mi ━━━━━</div><div className="bm-attrib">Map styling · Boulder County</div>
            </div>
          </section>

          <aside className="bm-side">
            <section className="bm-card bm-trip"><div className="bm-card-title">Trip overview <span>TRANSIT</span></div><div className="bm-trip-score"><strong>32<small> min</small></strong><span className="bm-confidence">92% on time</span></div>{stops.map((stop) => <div className="bm-trip-row" key={stop.time}><time className="bm-time">{stop.time}</time><div className="bm-node" style={{ "--teal": stop.color } as React.CSSProperties}><strong>{stop.title}</strong><span>{stop.detail}</span></div></div>)}</section>
            <section className="bm-card bm-weather"><div className="bm-card-title">At your origin <span>08:30 NOW</span></div><div className="bm-temp"><strong>18°</strong><span>◒</span></div><p>Clear skies · feels like 17°</p><div className="bm-weather-grid"><div><b>WIND</b><span>9 km/h</span></div><div><b>AIR</b><span>Good</span></div><div><b>RAIN</b><span>0%</span></div></div></section>
          </aside>
        </main>
        {showContrast && <div className="bm-contrast"><div className="bm-contrast-head"><h3>Contrast check · dark mode</h3><button className="bm-close" onClick={() => setShowContrast(false)} aria-label="Dismiss contrast check">×</button></div><p>Essential text and controls stay comfortably legible against the deep green surface. Secondary text is reserved for supporting metadata.</p><div className="bm-meter"><i /></div><div className="bm-meter-label"><span>AA baseline</span><span>92 / 100</span></div></div>}
        <footer className="bm-footer"><span>Designed for the Front Range · 40.015° N, 105.270° W</span><button onClick={() => { setSaved(!saved); announce(saved ? "Trip removed from saved trips" : "Trip saved"); }}>{saved ? "Saved ✓" : "Save this trip"}</button></footer>
      </div>
      {notice && <div className="bm-notice" role="status">{notice}</div>}
    </div>
  );
}