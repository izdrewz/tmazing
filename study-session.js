(() => {
  const HUB_KEYS = ["tmazing-uni-hub-v2", "tmazing-uni-hub-v1"];
  const SESSION_KEY = "tmazing-study-session-v1";
  const DAY_MS = 86400000;
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const mondayKey = date => {
    const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10);
  };
  const weekKey = () => mondayKey(new Date());

  function hubBundle() {
    for (const key of HUB_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) return { key, data: JSON.parse(raw) };
    }
    return { key: HUB_KEYS[0], data: { deadlines: [], goals: [], sources: [], draft: "", citations: [] } };
  }
  function saveHub(bundle) { localStorage.setItem(bundle.key, JSON.stringify(bundle.data)); }
  function session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || defaultSession(); } catch { return defaultSession(); } }
  function defaultSession() { return { startedAt: new Date().toISOString(), dailyGoals: {}, logs: [], weeklyReviews: {}, knownSources: [], sourceDecisions: {}, backupReminders: {} }; }
  function saveSession(data) { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
  function esc(v) { return String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function slug(v) { return String(v || "study-session").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "study-session"; }

  function init() {
    const s = session();
    const h = hubBundle().data;
    if (!s.knownSources.length) s.knownSources = (h.sources || []).map(x => x.id);
    saveSession(s);
    injectPanel();
    maybeAutoOpen();
    setInterval(updateSummary, 4000);
  }

  function newSources() {
    const s = session();
    const h = hubBundle().data;
    const known = new Set(s.knownSources || []);
    return (h.sources || []).filter(source => !known.has(source.id) || String(source.created || "").slice(0, 10) === todayKey());
  }

  function injectPanel() {
    if (document.getElementById("studySessionPanel")) return;
    const panel = document.createElement("section");
    panel.id = "studySessionPanel";
    panel.className = "panel session-panel wide-panel";
    panel.innerHTML = `
      <div>
        <p class="eyebrow">Study session vault</p>
        <h2>Goals, deadlines, source files, local saves, and GitHub library packs</h2>
        <p id="studySessionSummary" class="help-text">Loading session summary…</p>
      </div>
      <div class="actions-row">
        <button id="studyGoalsBtn" type="button">Today's study goals</button>
        <button id="endStudySessionBtn" type="button">End session</button>
        <button id="studyReviewBtn" class="ghost" type="button">Weekly review</button>
        <button id="downloadVaultBtn" class="ghost" type="button">Download vault</button>
      </div>`;
    const main = document.querySelector("main.app-shell");
    main?.insertBefore(panel, main.firstChild);
    document.getElementById("studyGoalsBtn").onclick = openGoals;
    document.getElementById("endStudySessionBtn").onclick = openEndSession;
    document.getElementById("studyReviewBtn").onclick = openWeeklyReview;
    document.getElementById("downloadVaultBtn").onclick = () => downloadStudyPack("tmazing-vault", buildPack("manual-vault-download"));
    updateSummary();
  }

  function updateSummary() {
    const el = document.getElementById("studySessionSummary"); if (!el) return;
    const h = hubBundle().data; const s = session();
    const deadlines = (h.deadlines || []).filter(d => !d.done);
    const soon = deadlines.filter(d => d.date && (new Date(d.date) - new Date()) / DAY_MS <= 7).length;
    const added = newSources().length;
    const goal = s.dailyGoals[todayKey()];
    el.textContent = `${deadlines.length} active deadline(s), ${soon} due within 7 days, ${added} source(s) touched this session${goal ? ` • Goal: ${goal.slice(0, 90)}` : ""}`;
  }

  function openModal(title, body, onSave, saveLabel = "Save") {
    document.getElementById("studySessionModal")?.remove();
    const modal = document.createElement("div");
    modal.id = "studySessionModal";
    modal.className = "session-modal-backdrop";
    modal.innerHTML = `<section class="session-modal panel" role="dialog" aria-modal="true"><div class="section-head"><div><p class="eyebrow">Tmazing session</p><h2>${esc(title)}</h2></div><button id="closeStudyModal" class="ghost" type="button">Close</button></div><div class="session-modal-body">${body}</div><div class="actions-row"><button id="saveStudyModal" type="button">${esc(saveLabel)}</button><button id="cancelStudyModal" class="ghost" type="button">Cancel</button></div></section>`;
    document.body.appendChild(modal);
    document.getElementById("closeStudyModal").onclick = () => modal.remove();
    document.getElementById("cancelStudyModal").onclick = () => modal.remove();
    document.getElementById("saveStudyModal").onclick = async () => { await onSave?.(modal); modal.remove(); updateSummary(); };
  }

  function openGoals(auto = false) {
    const s = session();
    const existing = s.dailyGoals[todayKey()] || "";
    const h = hubBundle().data;
    const deadlineText = upcomingDeadlines(h).map(d => `• ${d.title || "Untitled"} ${d.module ? `(${d.module})` : ""} — ${d.date || "no date"}`).join("\n");
    openModal("Today's study goals", `<label>Today's goals<textarea id="todayStudyGoals" rows="7" placeholder="Example: read K102 Block 2, upload source PDF, draft 300 words…">${esc(existing)}</textarea></label><div class="snippet"><strong>Deadline reminder</strong><br>${esc(deadlineText || "No dated active deadlines.")}</div>`, modal => {
      const data = session();
      data.dailyGoals[todayKey()] = modal.querySelector("#todayStudyGoals").value.trim();
      data.logs.push({ at: new Date().toISOString(), type: "daily-goals", goals: data.dailyGoals[todayKey()] });
      saveSession(data);
    });
    if (auto) document.getElementById("studySessionModal")?.classList.add("auto-open");
  }

  function upcomingDeadlines(h) {
    return (h.deadlines || []).filter(d => !d.done).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).slice(0, 8);
  }

  function openEndSession() {
    const sources = newSources();
    const rows = sources.map(source => `<label class="carry-row"><span><strong>${esc(source.title)}</strong><br><small>${esc(source.module)} • ${esc(source.unit)} • ${esc(source.fileName || source.fileType || "manual")}</small></span><select data-source="${source.id}"><option value="keep">Keep in library and export separately</option><option value="merge">Merge into compiled session file</option><option value="delete">Delete from browser library after export</option></select></label>`).join("") || '<p class="help-text">No new/touched sources found for this session.</p>';
    openModal("End session and save files", `
      <label>What should the local files be called?<input id="sessionFileName" value="tmazing-${todayKey()}"></label>
      <label>Review or edit compiled session notes before saving<textarea id="compiledSessionText" rows="12">${esc(buildMarkdownPack(sources, "session-review"))}</textarea></label>
      <div class="carry-list">${rows}</div>
      <p class="help-text">Save location: supported browsers may ask where to save. Otherwise files download to your Downloads folder. GitHub cannot be silently written to from a browser page, so this also creates a GitHub-library pack you can upload to the repo's /library folder.</p>
    `, async modal => {
      const name = slug(modal.querySelector("#sessionFileName").value);
      const markdown = modal.querySelector("#compiledSessionText").value;
      const h = hubBundle();
      const data = session();
      const decisions = {};
      modal.querySelectorAll("select[data-source]").forEach(sel => decisions[sel.dataset.source] = sel.value);
      h.data.sources = (h.data.sources || []).filter(source => decisions[source.id] !== "delete");
      saveHub(h);
      data.knownSources = [...new Set([...(data.knownSources || []), ...sources.map(s => s.id)])];
      data.sourceDecisions = { ...data.sourceDecisions, ...decisions };
      data.logs.push({ at: new Date().toISOString(), type: "end-study-session", fileName: name, decisions, sourceCount: sources.length });
      saveSession(data);
      await saveTextFile(`${name}.md`, markdown);
      await downloadStudyPack(`${name}-github-library-pack`, buildPack("end-session", markdown, decisions));
      alert("Session saved. If your browser did not ask for a folder, check Downloads. Upload the GitHub library pack to the repo's /library folder when you want it stored in GitHub.");
      setTimeout(() => location.reload(), 150);
    }, "Save session files");
  }

  function openWeeklyReview() {
    const h = hubBundle().data; const s = session();
    const weekStart = weekKey();
    const deadlines = upcomingDeadlines(h);
    const goals = (h.goals || []).map(g => `<tr><td>${esc(g.title || "Untitled")}</td><td>${esc(g.type)}</td><td>${esc(g.status)}</td></tr>`).join("");
    const sourceCount = (h.sources || []).length;
    const addedThisWeek = (h.sources || []).filter(src => mondayKey(src.created || new Date()) === weekStart).length;
    openModal("Monday weekly study review", `
      <p class="help-text">Review deadlines, goals, uploaded sources, and what needs doing next.</p>
      <div class="snippet"><strong>Upcoming deadlines</strong><br>${esc(deadlines.map(d => `${d.title || "Untitled"} — ${d.module || ""} — ${d.date || "no date"}`).join("\n") || "No active deadlines.")}</div>
      <table class="review-table"><thead><tr><th>Goal</th><th>Type</th><th>Status</th></tr></thead><tbody>${goals || '<tr><td colspan="3">No goals yet.</td></tr>'}</tbody></table>
      <p class="help-text">Sources in library: ${sourceCount}. Sources added this week: ${addedThisWeek}.</p>
      <label>Weekly review notes<textarea id="studyWeeklyReview" rows="6" placeholder="What is due? What should you focus on? What files/sources need cleaning up?"></textarea></label>
    `, modal => {
      const data = session();
      data.weeklyReviews[weekStart] = { at: new Date().toISOString(), note: modal.querySelector("#studyWeeklyReview").value.trim(), sourceCount, addedThisWeek };
      data.logs.push({ at: new Date().toISOString(), type: "weekly-study-review", week: weekStart, sourceCount, addedThisWeek });
      saveSession(data);
    });
  }

  function buildPack(reason, markdown = "", decisions = {}) {
    const h = hubBundle().data;
    return { exportedAt: new Date().toISOString(), reason, instructions: "Upload this JSON/MD to the GitHub repo's /library folder if you want a GitHub copy. The app cannot silently commit to GitHub from GitHub Pages.", hub: h, session: session(), decisions, compiledMarkdown: markdown || buildMarkdownPack(h.sources || [], reason) };
  }
  function buildMarkdownPack(sources, reason) {
    const h = hubBundle().data; const s = session();
    const sourceList = (sources || []).map(source => `## ${source.title || "Untitled source"}\n\n- Module: ${source.module || ""}\n- Unit/block: ${source.unit || ""}\n- Author(s): ${source.authors || ""}\n- Year: ${source.year || ""}\n- File: ${source.fileName || source.fileType || "manual/paste"}\n- URL/note: ${source.url || ""}\n\n${(source.text || "").slice(0, 12000)}\n`).join("\n---\n");
    return `# Tmazing session export\n\nReason: ${reason}\nDate: ${new Date().toLocaleString()}\nToday goals: ${s.dailyGoals[todayKey()] || ""}\n\n# Current draft\n\n${h.draft || ""}\n\n# Sources\n\n${sourceList || "No sources selected."}\n`;
  }

  async function saveTextFile(fileName, text) {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }] });
        const writable = await handle.createWritable(); await writable.write(text); await writable.close(); return;
      } catch (error) { if (error.name === "AbortError") return; }
    }
    downloadBlob(fileName, text, "text/markdown");
  }
  async function downloadStudyPack(baseName, pack) {
    downloadBlob(`${slug(baseName)}.json`, JSON.stringify(pack, null, 2), "application/json");
    downloadBlob(`${slug(baseName)}.md`, pack.compiledMarkdown || buildMarkdownPack(pack.hub?.sources || [], pack.reason), "text/markdown");
  }
  function downloadBlob(fileName, content, type) {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
  }

  function maybeAutoOpen() {
    const s = session();
    if (!s.dailyGoals[todayKey()]) setTimeout(() => openGoals(true), 700);
    const now = new Date();
    if (now.getDay() === 1 && !s.weeklyReviews[weekKey()]) setTimeout(() => openWeeklyReview(), 1400);
    const deadlines = upcomingDeadlines(hubBundle().data).filter(d => d.date && (new Date(d.date) - new Date()) / DAY_MS <= 7);
    if (deadlines.length && s.backupReminders.deadlineNotice !== todayKey()) {
      s.backupReminders.deadlineNotice = todayKey(); saveSession(s);
      setTimeout(() => alert(`Deadline reminder: ${deadlines.length} active deadline(s) due within 7 days.`), 2000);
    }
  }

  init();
})();
