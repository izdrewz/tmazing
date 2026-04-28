const STORE_KEY = "tmazing-uni-hub-v2";
const OLD_STORE_KEY = "tmazing-uni-hub-v1";
const DEFAULT_IGNORE = `a
an
and
are
as
at
be
because
been
but
by
for
from
has
have
he
her
his
i
in
is
it
its
of
on
or
our
she
so
that
the
their
them
then
there
these
they
this
to
was
we
were
which
with
you
your`;

let state = loadState();
let pendingFile = null;
const $ = id => document.getElementById(id);
const els = {
  deadlineList: $("deadlineList"), goalList: $("goalList"), sourceLibrary: $("sourceLibrary"), moduleFilter: $("moduleFilter"), librarySearch: $("librarySearch"),
  sourceForm: $("sourceForm"), sourceFile: $("sourceFile"), sourceText: $("sourceText"), fileStatus: $("fileStatus"), draftInput: $("draftInput"), highlightedDraft: $("highlightedDraft"),
  matchPanel: $("matchPanel"), citedDraft: $("citedDraft"), bibliography: $("bibliography"), ignoreWords: $("ignoreWords")
};

init();

function init() {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  normalise();
  bind();
  renderAll();
}

function bind() {
  $("addDeadline").addEventListener("click", () => { state.deadlines.push({ id: id(), title: "", module: "", date: "", notes: "", done: false }); save(); renderDeadlines(); });
  $("addGoal").addEventListener("click", () => { state.goals.push({ id: id(), title: "", type: "Study", status: "Not started", notes: "" }); save(); renderGoals(); });
  els.sourceForm.addEventListener("submit", addSource);
  els.sourceFile.addEventListener("change", readSourceFile);
  els.librarySearch.addEventListener("input", renderLibrary);
  els.moduleFilter.addEventListener("change", renderLibrary);
  $("analyseDraft").addEventListener("click", () => analyseDraft(true));
  $("clearDraft").addEventListener("click", () => { els.draftInput.value = ""; state.draft = ""; state.citations = []; save(); analyseDraft(); renderCitedDraft(); });
  $("copyCitedDraft").addEventListener("click", () => copyText(els.citedDraft.value));
  $("copyBibliography").addEventListener("click", () => copyText(els.bibliography.innerText));
  $("saveIgnore").addEventListener("click", () => { state.ignoreWords = parseIgnore(els.ignoreWords.value); save(); analyseDraft(); });
  $("resetIgnore").addEventListener("click", () => { state.ignoreWords = parseIgnore(DEFAULT_IGNORE); els.ignoreWords.value = state.ignoreWords.join("\n"); save(); analyseDraft(); });
  $("exportData").addEventListener("click", exportData);
  $("importData").addEventListener("change", importData);
  els.draftInput.addEventListener("input", () => { state.draft = els.draftInput.value; save(); renderCitedDraft(); });
  $("minWordLength").addEventListener("input", () => analyseDraft(false));
  $("matchMode").addEventListener("change", () => analyseDraft(false));
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || localStorage.getItem(OLD_STORE_KEY)) || defaultState(); }
  catch { return defaultState(); }
}
function defaultState() { return { deadlines: [], goals: [], sources: [], ignoreWords: parseIgnore(DEFAULT_IGNORE), draft: "", citations: [] }; }
function normalise() {
  state.deadlines ||= []; state.goals ||= []; state.sources ||= []; state.ignoreWords ||= parseIgnore(DEFAULT_IGNORE); state.draft ||= ""; state.citations ||= [];
  state.sources.forEach(source => {
    source.text ||= "";
    source.segments = Array.isArray(source.segments) && source.segments.length ? source.segments : segmentPlainText(source.text);
    source.fileName ||= "";
    source.fileType ||= "manual/paste";
  });
  save();
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function renderAll() { els.ignoreWords.value = state.ignoreWords.join("\n"); els.draftInput.value = state.draft; renderDeadlines(); renderGoals(); renderModuleFilter(); renderLibrary(); analyseDraft(false); renderCitedDraft(); }

function renderDeadlines() {
  els.deadlineList.innerHTML = "";
  if (!state.deadlines.length) { els.deadlineList.innerHTML = '<div class="empty-box">No deadlines yet.</div>'; return; }
  state.deadlines.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).forEach(d => {
    const card = $("deadlineTemplate").content.firstElementChild.cloneNode(true);
    card.classList.toggle("done", d.done);
    const days = daysUntil(d.date);
    if (days !== null && days < 0) card.classList.add("overdue"); else if (days !== null && days <= 7) card.classList.add("due-soon");
    bindField(card, ".deadline-title", d, "title"); bindField(card, ".deadline-module", d, "module"); bindField(card, ".deadline-date", d, "date"); bindField(card, ".deadline-notes", d, "notes");
    const done = document.createElement("button"); done.type = "button"; done.className = "ghost"; done.textContent = d.done ? "Mark active" : "Mark done"; done.onclick = () => { d.done = !d.done; save(); renderDeadlines(); };
    card.querySelector(".card-actions").prepend(done);
    card.querySelector(".remove-card").onclick = () => removeItem(state.deadlines, d.id, renderDeadlines);
    els.deadlineList.appendChild(card);
  });
}

function renderGoals() {
  els.goalList.innerHTML = "";
  if (!state.goals.length) { els.goalList.innerHTML = '<div class="empty-box">No goals yet.</div>'; return; }
  state.goals.forEach(g => {
    const card = $("goalTemplate").content.firstElementChild.cloneNode(true);
    card.classList.toggle("done", g.status === "Done");
    bindField(card, ".goal-title", g, "title"); bindField(card, ".goal-type", g, "type"); bindField(card, ".goal-status", g, "status"); bindField(card, ".goal-notes", g, "notes");
    card.querySelector(".remove-card").onclick = () => removeItem(state.goals, g.id, renderGoals);
    els.goalList.appendChild(card);
  });
}

function bindField(root, selector, object, key) { const el = root.querySelector(selector); el.value = object[key] || ""; el.addEventListener("input", () => { object[key] = el.value; save(); }); }
function removeItem(arr, itemId, after) { if (!confirm("Remove this item?")) return; const index = arr.findIndex(x => x.id === itemId); if (index > -1) arr.splice(index, 1); save(); after(); }
function daysUntil(dateStr) { if (!dateStr) return null; const today = new Date(); today.setHours(0,0,0,0); const d = new Date(dateStr); d.setHours(0,0,0,0); return Math.round((d - today) / 86400000); }

async function readSourceFile() {
  const file = els.sourceFile.files?.[0]; if (!file) return;
  pendingFile = null;
  setFileStatus(`Reading ${file.name}...`);
  try {
    pendingFile = await parseUploadedFile(file);
    els.sourceText.value = pendingFile.text;
    if (!$("sourceTitle").value.trim()) $("sourceTitle").value = file.name.replace(/\.[^.]+$/, "");
    if (!$("sourceUrl").value.trim()) $("sourceUrl").value = `Uploaded file: ${file.name}`;
    setFileStatus(`Ready: ${pendingFile.segments.length} searchable ${pendingFile.segments.length === 1 ? "segment" : "segments"} extracted from ${file.name}.`);
  } catch (error) {
    console.error(error);
    pendingFile = null;
    setFileStatus("");
    alert(error.message || "Could not read that file. Try pasting the source text manually.");
  }
}

async function parseUploadedFile(file) {
  const name = file.name;
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return parsePdf(file);
  if (ext === "docx") return parseDocx(file);
  if (["txt", "md", "csv", "html", "htm", "json", "rtf"].includes(ext)) {
    const text = await file.text();
    return { fileName: name, fileType: ext, text, segments: segmentPlainText(text) };
  }
  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, MD, CSV, HTML, JSON, RTF, or paste the source text manually.");
}

async function parsePdf(file) {
  if (!window.pdfjsLib) throw new Error("PDF reader did not load. Check your internet connection or paste the PDF text manually.");
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const segments = [];
  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      pageTexts.push(`[Page ${pageNum}]\n${text}`);
      segments.push({ id: id(), location: `Page ${pageNum}`, citationLocator: `p. ${pageNum}`, text });
    }
  }
  if (!segments.length) throw new Error("No selectable text was found in this PDF. It may be scanned/image-only, so paste text manually.");
  return { fileName: file.name, fileType: "pdf", text: pageTexts.join("\n\n"), segments };
}

async function parseDocx(file) {
  if (!window.mammoth) throw new Error("DOCX reader did not load. Check your internet connection or paste the Word text manually.");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = (result.value || "").trim();
  if (!text) throw new Error("No text was found in this DOCX. Try pasting the text manually.");
  return { fileName: file.name, fileType: "docx", text, segments: segmentPlainText(text, "Paragraph") };
}

function segmentPlainText(text, label = "Paragraph") {
  const pieces = String(text || "").split(/\n\s*\n+/).map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!pieces.length && String(text || "").trim()) pieces.push(String(text).replace(/\s+/g, " ").trim());
  return pieces.map((piece, index) => ({ id: id(), location: `${label} ${index + 1}`, citationLocator: `${label.toLowerCase()} ${index + 1}`, text: piece }));
}
function setFileStatus(message) { if (els.fileStatus) els.fileStatus.textContent = message; }

function addSource(event) {
  event.preventDefault();
  const manualText = els.sourceText.value.trim();
  if (!manualText) { alert("Add source text so the checker can search it."); return; }
  const segments = pendingFile && pendingFile.text === manualText ? pendingFile.segments : segmentPlainText(manualText);
  state.sources.push({
    id: id(), module: val("moduleCode").toUpperCase(), unit: val("unitBlock"), title: val("sourceTitle"), authors: val("sourceAuthors"), year: val("sourceYear"),
    publisher: val("sourcePublisher"), url: val("sourceUrl"), pages: val("sourcePages"), text: manualText, segments,
    fileName: pendingFile?.fileName || "", fileType: pendingFile?.fileType || "manual/paste", created: new Date().toISOString()
  });
  pendingFile = null; setFileStatus(""); save(); event.target.reset(); renderModuleFilter(); renderLibrary(); analyseDraft(false);
}
function val(fieldId) { return $(fieldId).value.trim(); }

function renderModuleFilter() {
  const current = els.moduleFilter.value;
  const modules = [...new Set(state.sources.map(s => s.module).filter(Boolean))].sort();
  els.moduleFilter.innerHTML = '<option value="">All modules</option>' + modules.map(m => `<option>${esc(m)}</option>`).join("");
  els.moduleFilter.value = modules.includes(current) ? current : "";
}

function renderLibrary() {
  const q = norm(els.librarySearch.value || ""); const mod = els.moduleFilter.value;
  els.sourceLibrary.innerHTML = "";
  const list = state.sources.filter(s => (!mod || s.module === mod) && (!q || sourceHaystack(s).includes(q)));
  if (!list.length) { els.sourceLibrary.innerHTML = '<div class="empty-box">No matching sources yet.</div>'; return; }
  list.forEach(s => {
    const card = document.createElement("article"); card.className = "source-card";
    const snips = q ? snippetsForSource(s, q, 3) : [];
    card.innerHTML = `<h3>${esc(s.title)}</h3><p class="source-meta">${esc(s.module)} • ${esc(s.unit)} • ${esc(s.authors)} (${esc(s.year)}) ${s.pages ? `• ${esc(s.pages)}` : ""}</p><p class="source-meta">${esc(s.fileType || "manual/paste")}${s.fileName ? ` • ${esc(s.fileName)}` : ""} • ${s.segments?.length || 0} searchable segment(s)</p><p class="source-meta">${esc(harvardRef(s))}</p><div>${snips.map(x => `<div class="snippet"><span class="location-chip">${esc(x.location)}</span> ${x.html}</div>`).join("")}</div><div class="source-actions"><button class="ghost" data-act="copy">Copy Harvard ref</button><button class="ghost" data-act="view">View source areas</button><button class="danger" data-act="remove">Remove</button></div>`;
    card.querySelector('[data-act="copy"]').onclick = () => copyText(harvardRef(s));
    card.querySelector('[data-act="view"]').onclick = () => showSourceAreas(s);
    card.querySelector('[data-act="remove"]').onclick = () => { if (!confirm("Remove this source?")) return; state.sources = state.sources.filter(x => x.id !== s.id); state.citations = state.citations.filter(c => c.sourceId !== s.id); save(); renderModuleFilter(); renderLibrary(); analyseDraft(false); renderCitedDraft(); };
    els.sourceLibrary.appendChild(card);
  });
}
function sourceHaystack(source) { return norm([source.module, source.unit, source.title, source.authors, source.year, source.publisher, source.url, source.pages, source.fileName, source.fileType, source.text, ...(source.segments || []).map(s => `${s.location} ${s.text}`)].join(" ")); }
function showSourceAreas(source) { alert((source.segments || []).slice(0, 20).map(seg => `${seg.location}\n${seg.text.slice(0, 1000)}`).join("\n\n---\n\n") || source.text.slice(0, 8000)); }

function analyseDraft(showEmpty = true) {
  const draft = els.draftInput.value; state.draft = draft; save();
  els.matchPanel.className = "match-panel empty-box"; els.matchPanel.textContent = "Select a highlighted word or phrase.";
  if (!draft.trim()) { els.highlightedDraft.className = "draft-output empty-box"; els.highlightedDraft.textContent = showEmpty ? "Paste a draft and run the checker." : "Run the checker to see linked words and phrases here."; return; }
  const matches = findDraftMatches(draft);
  els.highlightedDraft.className = "draft-output"; els.highlightedDraft.innerHTML = buildHighlightedHtml(draft, matches);
  els.highlightedDraft.querySelectorAll(".linked-word").forEach(btn => {
    const open = () => showMatches(btn.dataset.key, Number(btn.dataset.start), Number(btn.dataset.end));
    btn.addEventListener("click", open); btn.addEventListener("mouseenter", open);
  });
  renderCitedDraft();
}

function findDraftMatches(text) {
  const ignore = new Set(state.ignoreWords.map(norm));
  const min = Number($("minWordLength").value) || 5;
  const mode = $("matchMode").value;
  const words = wordTokens(text);
  const matches = [];
  let i = 0;
  while (i < words.length) {
    let found = null;
    if (mode === "phrase") {
      for (let len = 4; len >= 2; len--) {
        const slice = words.slice(i, i + len); if (slice.length < len) continue;
        const phrase = slice.map(x => x.text).join(" ");
        const parts = phrase.split(/\s+/).map(norm);
        if (parts.some(w => ignore.has(w) || w.length < min)) continue;
        const sources = findSourcesFor(phrase);
        if (sources.length) { found = { key: phrase, start: slice[0].start, end: slice[slice.length - 1].end, type: "phrase", sources }; break; }
      }
    }
    if (!found) {
      const word = words[i].text; const n = norm(word);
      if (n.length >= min && !ignore.has(n)) { const sources = findSourcesFor(word); if (sources.length) found = { key: word, start: words[i].start, end: words[i].end, type: "word", sources }; }
    }
    if (found) { matches.push(found); i += found.type === "phrase" ? found.key.split(/\s+/).length : 1; } else i++;
  }
  return matches;
}

function wordTokens(text) { const re = /[A-Za-zÀ-ÖØ-öø-ÿ0-9'-]+/g; let m, arr = []; while ((m = re.exec(text))) arr.push({ text: m[0], start: m.index, end: m.index + m[0].length }); return arr; }
function findSourcesFor(term) {
  const n = norm(term); if (!n) return [];
  const matches = [];
  state.sources.forEach(source => {
    (source.segments || segmentPlainText(source.text)).forEach(segment => {
      if (norm(segment.text).includes(n)) matches.push({ source, segment, score: n.split(" ").length, snippet: snippetAround(segment.text, term) });
    });
  });
  return matches.sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title)).slice(0, 8);
}
function buildHighlightedHtml(text, matches) { let html = "", pos = 0; matches.forEach(m => { html += esc(text.slice(pos, m.start)); html += `<button class="linked-word ${m.type === "phrase" ? "phrase" : ""}" data-key="${escAttr(m.key)}" data-start="${m.start}" data-end="${m.end}" title="${m.sources.length} source match(es)">${esc(text.slice(m.start, m.end))}</button>`; pos = m.end; }); return html + esc(text.slice(pos)); }

function showMatches(key, start, end) {
  const found = findSourcesFor(key); els.matchPanel.className = "match-panel";
  if (!found.length) { els.matchPanel.textContent = "No source matches found."; return; }
  els.matchPanel.innerHTML = `<p><span class="citation-chip">${esc(key)}</span> matched ${found.length} source area(s).</p>` + found.map((m, index) => `<div class="match-item"><div class="match-title">${esc(m.source.title)}</div><div class="source-meta">${esc(m.source.module)} • ${esc(m.source.unit)} • ${esc(m.source.authors)} (${esc(m.source.year)}) • <span class="location-chip">${esc(m.segment.location)}</span></div><div class="snippet">${m.snippet}</div><div class="source-actions"><button data-add-index="${index}">Add citation ${esc(inlineCitation(m.source, m.segment.citationLocator))}</button><button class="ghost" data-copy-index="${index}">Copy ref</button><button class="ghost" data-area-index="${index}">View area</button><button class="ghost" data-ignore="${escAttr(key)}">Ignore this term</button></div></div>`).join("");
  els.matchPanel.querySelectorAll("[data-add-index]").forEach(b => b.onclick = () => { const m = found[Number(b.dataset.addIndex)]; addCitation(start, end, m.source.id, m.segment.citationLocator); });
  els.matchPanel.querySelectorAll("[data-copy-index]").forEach(b => b.onclick = () => copyText(harvardRef(found[Number(b.dataset.copyIndex)].source)));
  els.matchPanel.querySelectorAll("[data-area-index]").forEach(b => b.onclick = () => { const m = found[Number(b.dataset.areaIndex)]; alert(`${m.source.title}\n${m.segment.location}\n\n${m.segment.text}`); });
  els.matchPanel.querySelectorAll("[data-ignore]").forEach(b => b.onclick = () => ignoreTerm(b.dataset.ignore));
}

function addCitation(start, end, sourceId, locator = "") {
  if (!state.citations.find(c => c.start === start && c.end === end && c.sourceId === sourceId && (c.locator || "") === locator)) state.citations.push({ id: id(), start, end, sourceId, locator });
  save(); renderCitedDraft();
}
function renderCitedDraft() {
  const text = state.draft || els.draftInput.value || "";
  if (!text) { els.citedDraft.value = ""; els.bibliography.className = "bibliography empty-box"; els.bibliography.textContent = "No selected citations yet."; return; }
  const cites = state.citations.filter(c => sourceById(c.sourceId) && c.end <= text.length).sort((a, b) => b.end - a.end);
  let out = text; cites.forEach(c => { out = out.slice(0, c.end) + ` ${inlineCitation(sourceById(c.sourceId), c.locator)}` + out.slice(c.end); });
  els.citedDraft.value = out;
  const refs = [...new Map(cites.map(c => [c.sourceId, sourceById(c.sourceId)])).values()].filter(Boolean).sort((a, b) => harvardSort(a).localeCompare(harvardSort(b)));
  if (!refs.length) { els.bibliography.className = "bibliography empty-box"; els.bibliography.textContent = "No selected citations yet."; return; }
  els.bibliography.className = "bibliography"; els.bibliography.innerHTML = refs.map(s => `<p>${esc(harvardRef(s))}</p>`).join("");
}

function inlineCitation(source, locator = "") { return `(${citationName(source.authors)}, ${source.year || "n.d."}${locator ? `, ${locator}` : ""})`; }
function citationName(authors) { const a = (authors || "Unknown author").split(/\s+and\s+|;/i).filter(Boolean); const surname = x => { x = x.trim(); if (x.includes(",")) return x.split(",")[0].trim(); const p = x.split(/\s+/); return p[p.length - 1] || x; }; if (a.length === 1) return surname(a[0]); if (a.length === 2) return `${surname(a[0])} and ${surname(a[1])}`; return `${surname(a[0])} et al.`; }
function harvardRef(source) { const pub = source.publisher ? ` ${source.publisher}.` : ""; const loc = source.pages ? ` ${source.pages}.` : ""; const url = source.url ? ` Available at: ${source.url}.` : ""; return `${source.authors || "Unknown author"} (${source.year || "n.d."}) ${source.title || "Untitled source"}.${pub}${loc}${url}`.replace(/\s+/g, " ").trim(); }
function harvardSort(source) { return `${source.authors || source.title || ""} ${source.year || ""}`.toLowerCase(); }
function sourceById(sourceId) { return state.sources.find(s => s.id === sourceId); }
function ignoreTerm(term) { const parts = term.split(/\s+/).map(norm).filter(Boolean); state.ignoreWords = [...new Set([...state.ignoreWords, ...parts])].sort(); els.ignoreWords.value = state.ignoreWords.join("\n"); save(); analyseDraft(); }
function parseIgnore(value) { return [...new Set(String(value).split(/[\s,]+/).map(norm).filter(Boolean))].sort(); }

function snippetsForSource(source, q, count = 3) {
  const out = [];
  (source.segments || []).forEach(segment => { if (out.length < count && norm(segment.text).includes(q)) out.push({ location: segment.location, html: snippetAround(segment.text, q) }); });
  return out;
}
function snippetAround(text, term) {
  const lower = text.toLowerCase(), n = String(term).toLowerCase(); let index = lower.indexOf(n);
  if (index < 0) index = Math.max(0, norm(text).indexOf(norm(term)));
  const start = Math.max(0, index - 110); const end = Math.min(text.length, index + String(term).length + 130);
  let snippet = esc(text.slice(start, end));
  const safe = escapeRegExp(esc(term));
  try { snippet = snippet.replace(new RegExp(safe, "ig"), m => `<mark>${m}</mark>`); } catch {}
  return `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}`;
}
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function copyText(text) { navigator.clipboard?.writeText(text).then(() => alert("Copied.")).catch(() => alert("Copy failed. Select and copy manually.")); }
function exportData() { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "tmazing-uni-hub-backup.json"; a.click(); URL.revokeObjectURL(url); }
function importData(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(String(reader.result)); if (!data || !Array.isArray(data.sources)) throw new Error("Invalid backup"); if (!confirm("Import this backup? It will replace the data in this browser.")) return; state = data; normalise(); save(); renderAll(); } catch { alert("Could not import that file."); } finally { event.target.value = ""; } }; reader.readAsText(file); }
function norm(value) { return String(value || "").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ").trim(); }
function esc(value) { return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escAttr(value) { return esc(value).replaceAll("\n", " "); }
function id() { return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
