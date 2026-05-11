(() => {
  if (window.__tmazingFeedbackMarkupToolLoaded) return;
  window.__tmazingFeedbackMarkupToolLoaded = true;

  const STORAGE_KEY = "tmazing-feedback-markup-library-v1";
  const CATEGORY_LABELS = {
    inline: "Inline",
    "assessment-summary": "Assessment summary",
    "study-support-files": "Study support files"
  };
  const DEFAULT_MODULES = ["K102", "E104"];

  const MARKUP_PROMPT = `I need you to work on this DOCX exactly and carefully.\n\nTask:\nInsert each visible inline markup/comment/feedback note verbatim after the line or sentence it is attached to. Put each inserted feedback note in square brackets.\n\nRules:\n- Do not rewrite my wording.\n- Do not polish, shorten, expand, correct, or paraphrase my document text.\n- Do not change anything except inserting the visible feedback comments in square brackets.\n- Copy the feedback wording verbatim.\n- Place each bracketed feedback note immediately after the attached line/sentence/paragraph.\n- Keep the original comments/markup present unless removing them is technically unavoidable.\n- After editing, compare the edited DOCX against the original DOCX at document level.\n- Tell me every visible text difference.\n- Confirm whether every difference is an expected bracketed feedback insertion or an accidental change.\n- If anything changed beyond the bracketed feedback insertions, say exactly what changed.\n\nOutput needed:\n1. Edited DOCX.\n2. Verification report.\n3. Feedback extraction JSON with module, TMA, category, anchor text, feedback verbatim, and action needed.`;

  function uid() {
    return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function esc(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function norm(value) {
    return clean(value).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function getState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { records: Array.isArray(parsed.records) ? parsed.records : [], dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [] };
    } catch {
      return { records: [], dismissed: [] };
    }
  }

  function setState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ records: state.records || [], dismissed: state.dismissed || [] }, null, 2));
  }

  function records() {
    return getState().records;
  }

  function modules() {
    return [...new Set([...DEFAULT_MODULES, ...records().map(r => r.module).filter(Boolean)])].sort();
  }

  function tmasFor(module) {
    return [...new Set(records().filter(r => !module || r.module === module).map(r => r.tma).filter(Boolean))].sort();
  }

  function insertPanel() {
    if (document.getElementById("feedbackMarkup")) return;
    const main = document.querySelector(".app-shell") || document.body;
    const goals = document.getElementById("goals");
    const section = document.createElement("section");
    section.id = "feedbackMarkup";
    section.className = "panel wide-panel feedback-markup-panel";
    section.innerHTML = panelHtml();
    if (goals?.nextSibling) goals.parentNode.insertBefore(section, goals.nextSibling);
    else main.prepend(section);
    bindPanel();
    renderAll();
  }

  function panelHtml() {
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Feedback markup</p>
          <h2>Study support library</h2>
        </div>
        <div class="feedback-actions">
          <button id="feedbackExport" class="ghost" type="button">Export library JSON</button>
          <label class="file-button">Import library JSON<input id="feedbackImportLibrary" type="file" accept="application/json"></label>
        </div>
      </div>

      <div class="feedback-tabs" role="tablist" aria-label="Feedback markup sections">
        <button class="feedback-tab is-active" data-feedback-tab="start" type="button">Start ChatGPT task</button>
        <button class="feedback-tab" data-feedback-tab="import" type="button">Import feedback</button>
        <button class="feedback-tab" data-feedback-tab="library" type="button">Feedback library</button>
        <button class="feedback-tab" data-feedback-tab="check" type="button">Check draft</button>
      </div>

      <div id="feedbackTabStart" class="feedback-tab-panel">
        <div class="feedback-grid">
          <div class="feedback-prompt-box">
            <h3>Begin the inline markup task</h3>
            <p class="feedback-help">Open ChatGPT, upload the marked DOCX, then paste this prompt. It is written to prevent rewriting and only insert the visible feedback.</p>
            <div class="feedback-prompt-actions">
              <a class="file-button" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT</a>
              <button id="feedbackCopyPrompt" type="button">Copy prompt</button>
            </div>
          </div>
          <div class="feedback-prompt-box">
            <label>
              Prompt ready to send
              <textarea id="feedbackPromptText">${esc(MARKUP_PROMPT)}</textarea>
            </label>
          </div>
        </div>
      </div>

      <div id="feedbackTabImport" class="feedback-tab-panel feedback-hidden">
        <div class="feedback-grid">
          <form id="feedbackImportForm" class="feedback-box feedback-form-grid">
            <label>
              Module
              <select id="feedbackModuleSelect"></select>
            </label>
            <label>
              Add new module
              <input id="feedbackModuleNew" type="text" placeholder="K102, E104, DD102...">
            </label>
            <label>
              TMA / assessment name
              <input id="feedbackTmaName" type="text" placeholder="TMA05, EMTMA..." required>
            </label>
            <label>
              Category
              <select id="feedbackCategory">
                <option value="inline">Inline</option>
                <option value="assessment-summary">Assessment summary</option>
                <option value="study-support-files">Study support files</option>
              </select>
            </label>
            <label>
              Record title
              <input id="feedbackTitle" type="text" placeholder="Tutor inline comments, TMA05 summary, K102 support file...">
            </label>
            <label>
              File
              <input id="feedbackFile" type="file" accept=".docx,.txt,.md,.json,.pdf,.rtf">
            </label>
            <label class="full-span">
              Feedback / support content
              <textarea id="feedbackContent" rows="10" placeholder="Import a file or paste feedback/support text here."></textarea>
            </label>
            <label class="full-span">
              Notes / verification report
              <textarea id="feedbackNotes" rows="4" placeholder="Paste verification report, score notes, or context here."></textarea>
            </label>
            <button type="submit">Save to feedback library</button>
          </form>
          <div class="feedback-box">
            <h3>How imported records are sorted</h3>
            <p class="feedback-help">Records are grouped by module, then by TMA name, then by category: Inline, Assessment summary, and Study support files.</p>
            <p class="feedback-help">The browser stores imported content locally. Use Export library JSON to save a copy into the private feedback-markup repo.</p>
            <div id="feedbackImportStatus" class="feedback-empty">No import yet.</div>
          </div>
        </div>
      </div>

      <div id="feedbackTabLibrary" class="feedback-tab-panel feedback-hidden">
        <div class="feedback-filter-row">
          <label>Module filter<select id="feedbackLibraryModule"></select></label>
          <label>TMA filter<select id="feedbackLibraryTma"></select></label>
          <label>Category filter<select id="feedbackLibraryCategory"><option value="">All categories</option><option value="inline">Inline</option><option value="assessment-summary">Assessment summary</option><option value="study-support-files">Study support files</option></select></label>
          <input id="feedbackLibrarySearch" type="search" placeholder="Search feedback library...">
        </div>
        <div id="feedbackLibraryTree" class="feedback-library-tree"></div>
      </div>

      <div id="feedbackTabCheck" class="feedback-tab-panel feedback-hidden">
        <div class="feedback-grid">
          <div class="feedback-check-box">
            <h3>Select feedback to use</h3>
            <div class="feedback-filter-row">
              <label>Use mode<select id="feedbackUseMode"><option value="all">Use all feedback</option><option value="selected">Select individually</option></select></label>
              <label>Module<select id="feedbackCheckModule"></select></label>
              <label>TMA<select id="feedbackCheckTma"></select></label>
              <label>Category<select id="feedbackCheckCategory"><option value="">All categories</option><option value="inline">Inline</option><option value="assessment-summary">Assessment summary</option><option value="study-support-files">Study support files</option></select></label>
            </div>
            <div id="feedbackRecordSelectors" class="feedback-record-selectors"></div>
          </div>
          <div class="feedback-check-box">
            <h3>Check a draft against feedback</h3>
            <label>
              Upload draft to check
              <input id="feedbackDraftFile" type="file" accept=".docx,.txt,.md,.pdf,.rtf">
            </label>
            <label>
              Draft text
              <textarea id="feedbackDraftText" rows="12" placeholder="Upload or paste your draft here."></textarea>
            </label>
            <div class="feedback-draft-actions">
              <button id="feedbackRunCheck" type="button">Check draft</button>
              <button id="feedbackClearDraft" class="ghost" type="button">Clear</button>
            </div>
          </div>
        </div>
        <div class="feedback-check-box" style="margin-top:1rem;">
          <h3>Feedback check results</h3>
          <div id="feedbackCheckResults" class="feedback-results feedback-empty">Run a check to see feedback risks here.</div>
        </div>
      </div>
    `;
  }

  function bindPanel() {
    document.querySelectorAll("[data-feedback-tab]").forEach(button => {
      button.addEventListener("click", () => switchTab(button.dataset.feedbackTab));
    });
    document.getElementById("feedbackCopyPrompt")?.addEventListener("click", () => copyText(document.getElementById("feedbackPromptText")?.value || MARKUP_PROMPT));
    document.getElementById("feedbackImportForm")?.addEventListener("submit", saveRecordFromForm);
    document.getElementById("feedbackFile")?.addEventListener("change", handleFeedbackFile);
    document.getElementById("feedbackDraftFile")?.addEventListener("change", handleDraftFile);
    document.getElementById("feedbackExport")?.addEventListener("click", exportLibrary);
    document.getElementById("feedbackImportLibrary")?.addEventListener("change", importLibrary);
    document.getElementById("feedbackRunCheck")?.addEventListener("click", runDraftCheck);
    document.getElementById("feedbackClearDraft")?.addEventListener("click", () => {
      const el = document.getElementById("feedbackDraftText");
      if (el) el.value = "";
      renderResults([]);
    });
    ["feedbackLibraryModule", "feedbackLibraryTma", "feedbackLibraryCategory", "feedbackLibrarySearch", "feedbackCheckModule", "feedbackCheckTma", "feedbackCheckCategory", "feedbackUseMode"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", renderAll);
      document.getElementById(id)?.addEventListener("change", renderAll);
    });
  }

  function switchTab(tab) {
    document.querySelectorAll(".feedback-tab").forEach(b => b.classList.toggle("is-active", b.dataset.feedbackTab === tab));
    ["start", "import", "library", "check"].forEach(name => {
      document.getElementById(`feedbackTab${name[0].toUpperCase()}${name.slice(1)}`)?.classList.toggle("feedback-hidden", name !== tab);
    });
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  async function fileToText(file) {
    if (!file) return "";
    const name = file.name.toLowerCase();
    if (name.endsWith(".docx") && window.mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      return result.value || "";
    }
    if (name.endsWith(".pdf") && window.pdfjsLib) {
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await window.pdfjsLib.getDocument({ data }).promise;
      const pages = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(" "));
      }
      return pages.join("\n\n");
    }
    return await file.text();
  }

  async function handleFeedbackFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = document.getElementById("feedbackImportStatus");
    try {
      if (status) status.textContent = `Reading ${file.name}...`;
      const text = await fileToText(file);
      document.getElementById("feedbackContent").value = text;
      const title = document.getElementById("feedbackTitle");
      if (title && !title.value.trim()) title.value = file.name.replace(/\.[^.]+$/, "");
      if (status) status.textContent = `Imported text from ${file.name}. Check the category, module and TMA, then save.`;
    } catch (err) {
      if (status) status.textContent = `Could not read ${file.name}. Paste the text manually.`;
    }
  }

  async function handleDraftFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await fileToText(file);
    document.getElementById("feedbackDraftText").value = text;
  }

  function saveRecordFromForm(event) {
    event.preventDefault();
    const module = clean(document.getElementById("feedbackModuleNew")?.value) || document.getElementById("feedbackModuleSelect")?.value || "Unsorted";
    const tma = clean(document.getElementById("feedbackTmaName")?.value) || "Unsorted";
    const category = document.getElementById("feedbackCategory")?.value || "inline";
    const title = clean(document.getElementById("feedbackTitle")?.value) || `${module} ${tma} ${CATEGORY_LABELS[category]}`;
    const file = document.getElementById("feedbackFile")?.files?.[0];
    const text = document.getElementById("feedbackContent")?.value || "";
    const notes = document.getElementById("feedbackNotes")?.value || "";
    const extracted = extractFeedbackItems(text, category);
    const state = getState();
    state.records.push({
      id: uid(), module, tma, category, title,
      fileName: file?.name || "manual entry",
      fileType: file?.type || "text/manual",
      text, notes,
      extracted,
      importedAt: new Date().toISOString()
    });
    setState(state);
    event.target.reset();
    document.getElementById("feedbackImportStatus").textContent = `Saved ${title} under ${module} / ${tma} / ${CATEGORY_LABELS[category]}.`;
    renderAll();
    switchTab("library");
  }

  function extractFeedbackItems(text, category) {
    const items = [];
    const bracketed = [...String(text || "").matchAll(/\[([^\]]{8,900})\]/g)].map(m => clean(m[1]));
    bracketed.forEach((feedback, index) => items.push({ id: uid(), type: "bracketed", feedback, anchor: "", action: actionFromFeedback(feedback), index }));
    if (!items.length) {
      String(text || "").split(/\n+/).map(clean).filter(line => line.length > 18).slice(0, 80).forEach((line, index) => {
        items.push({ id: uid(), type: category, feedback: line, anchor: "", action: actionFromFeedback(line), index });
      });
    }
    return items;
  }

  function actionFromFeedback(feedback) {
    const f = norm(feedback);
    if (f.includes("open university") && (f.includes("abbreviation") || f.includes("ou"))) return "Check that The Open University is written in full rather than abbreviated.";
    if (f.includes("adverse childhood experiences") || f.includes("aces")) return "Check ACEs are written in full on first use and clearly explained.";
    if (f.includes("stigma")) return "Check stigma is explained and linked to the point being made.";
    if (f.includes("conclusion")) return "Check the conclusion returns to key points from the main body.";
    if (f.includes("plan") && f.includes("date")) return "Check plans include a review/end date where needed.";
    if (f.includes("reference")) return "Check referencing format and technical accuracy.";
    return "Check whether this previous feedback point applies to the current draft.";
  }

  function renderAll() {
    renderModuleSelects();
    renderLibrary();
    renderSelectors();
  }

  function fillSelect(id, values, allLabel = "All") {
    const el = document.getElementById(id);
    if (!el) return;
    const old = el.value;
    el.innerHTML = `<option value="">${allLabel}</option>${values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}`;
    if ([...el.options].some(o => o.value === old)) el.value = old;
  }

  function renderModuleSelects() {
    const moduleOptions = modules();
    const importSel = document.getElementById("feedbackModuleSelect");
    if (importSel) {
      const old = importSel.value;
      importSel.innerHTML = moduleOptions.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
      if ([...importSel.options].some(o => o.value === old)) importSel.value = old;
    }
    fillSelect("feedbackLibraryModule", moduleOptions, "All modules");
    fillSelect("feedbackCheckModule", moduleOptions, "All modules");

    const libMod = document.getElementById("feedbackLibraryModule")?.value || "";
    const checkMod = document.getElementById("feedbackCheckModule")?.value || "";
    fillSelect("feedbackLibraryTma", tmasFor(libMod), "All TMAs");
    fillSelect("feedbackCheckTma", tmasFor(checkMod), "All TMAs");
  }

  function filteredRecords(prefix) {
    const module = document.getElementById(`${prefix}Module`)?.value || "";
    const tma = document.getElementById(`${prefix}Tma`)?.value || "";
    const category = document.getElementById(`${prefix}Category`)?.value || "";
    const search = norm(document.getElementById("feedbackLibrarySearch")?.value || "");
    return records().filter(r => {
      if (module && r.module !== module) return false;
      if (tma && r.tma !== tma) return false;
      if (category && r.category !== category) return false;
      if (prefix.includes("Library") && search && !norm(`${r.module} ${r.tma} ${r.category} ${r.title} ${r.text} ${r.notes}`).includes(search)) return false;
      return true;
    });
  }

  function renderLibrary() {
    const root = document.getElementById("feedbackLibraryTree");
    if (!root) return;
    const list = filteredRecords("feedbackLibrary");
    if (!list.length) {
      root.innerHTML = `<div class="feedback-empty">No feedback records match this filter.</div>`;
      return;
    }
    const byModule = groupBy(list, r => r.module || "Unsorted");
    root.innerHTML = Object.entries(byModule).sort().map(([module, moduleRecords]) => {
      const byTma = groupBy(moduleRecords, r => r.tma || "Unsorted");
      return `<details class="feedback-module-group" open><summary>${esc(module)} (${moduleRecords.length})</summary>${Object.entries(byTma).sort().map(([tma, tmaRecords]) => {
        const byCategory = groupBy(tmaRecords, r => r.category || "inline");
        return `<details class="feedback-tma-group" open><summary>${esc(tma)} (${tmaRecords.length})</summary>${Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
          const catRecords = byCategory[cat] || [];
          if (!catRecords.length) return "";
          return `<div class="feedback-category-block ${cat}"><h4>${esc(label)}</h4>${catRecords.map(recordCard).join("")}</div>`;
        }).join("")}</details>`;
      }).join("")}</details>`;
    }).join("");
    root.querySelectorAll("[data-delete-feedback]").forEach(button => button.addEventListener("click", () => deleteRecord(button.dataset.deleteFeedback)));
  }

  function recordCard(r) {
    return `<article class="feedback-card">
      <h5>${esc(r.title)}</h5>
      <div class="feedback-chip-row"><span class="feedback-chip">${esc(r.module)}</span><span class="feedback-chip">${esc(r.tma)}</span><span class="feedback-chip category-${esc(r.category)}">${esc(CATEGORY_LABELS[r.category] || r.category)}</span></div>
      <p class="feedback-meta">${esc(r.fileName || "manual entry")} • ${new Date(r.importedAt || Date.now()).toLocaleDateString()}</p>
      <p class="feedback-excerpt">${esc((r.notes || r.text || "").slice(0, 260))}${(r.notes || r.text || "").length > 260 ? "…" : ""}</p>
      <div class="feedback-actions"><button class="ghost" type="button" data-delete-feedback="${r.id}">Remove</button></div>
    </article>`;
  }

  function deleteRecord(id) {
    const state = getState();
    state.records = state.records.filter(r => r.id !== id);
    setState(state);
    renderAll();
  }

  function groupBy(list, fn) {
    return list.reduce((acc, item) => {
      const key = fn(item);
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }

  function renderSelectors() {
    const root = document.getElementById("feedbackRecordSelectors");
    if (!root) return;
    const list = filteredRecords("feedbackCheck");
    const mode = document.getElementById("feedbackUseMode")?.value || "all";
    if (!list.length) {
      root.innerHTML = `<div class="feedback-empty">No feedback records match these check filters.</div>`;
      return;
    }
    root.innerHTML = list.map(r => `<label class="feedback-selector-card">
      <input type="checkbox" class="feedbackRecordCheck" value="${r.id}" ${mode === "all" ? "checked disabled" : "checked"}>
      <span><strong>${esc(r.title)}</strong><br><span class="feedback-meta">${esc(r.module)} / ${esc(r.tma)} / ${esc(CATEGORY_LABELS[r.category] || r.category)}</span></span>
    </label>`).join("");
  }

  function selectedRecords() {
    const list = filteredRecords("feedbackCheck");
    const mode = document.getElementById("feedbackUseMode")?.value || "all";
    if (mode === "all") return list;
    const ids = new Set([...document.querySelectorAll(".feedbackRecordCheck:checked")].map(el => el.value));
    return list.filter(r => ids.has(r.id));
  }

  function runDraftCheck() {
    const draft = document.getElementById("feedbackDraftText")?.value || "";
    const selected = selectedRecords();
    if (!draft.trim()) {
      renderResults([{ type: "empty", message: "Paste or upload a draft first." }]);
      return;
    }
    if (!selected.length) {
      renderResults([{ type: "empty", message: "Select at least one feedback record to check against." }]);
      return;
    }
    const results = [];
    selected.forEach(record => {
      buildRules(record).forEach(rule => {
        const hit = ruleFind(draft, rule);
        if (hit) results.push({ record, rule, hit, id: `${record.id}|${rule.key}|${hit.slice(0, 80)}` });
      });
    });
    renderResults(results);
  }

  function buildRules(record) {
    const rawItems = Array.isArray(record.extracted) && record.extracted.length ? record.extracted : extractFeedbackItems(record.text, record.category);
    const rules = [];
    rawItems.forEach(item => {
      const feedback = clean(item.feedback || item.action || "");
      if (!feedback) return;
      const f = norm(feedback);
      if (f.includes("open university") && (f.includes("abbreviation") || f.includes("ou"))) rules.push({ key: "ou-full", terms: [" ou ", "(ou", "ou,"], feedback, action: "Check whether OU should be written as The Open University." });
      if (f.includes("adverse childhood experiences") || f.includes("aces")) rules.push({ key: "aces-full", terms: ["aces", "adverse childhood"], feedback, action: "Check ACEs is written in full on first use and explained." });
      if (f.includes("stigma")) rules.push({ key: "stigma", terms: ["stigma", "stigmatis"], feedback, action: "Check stigma is explained and linked to the point." });
      if (f.includes("conclusion")) rules.push({ key: "conclusion", terms: ["conclusion", "overall", "to conclude"], feedback, action: "Check the conclusion draws from key body points." });
      if (f.includes("reference")) rules.push({ key: "reference", terms: ["references", "reference list", "bibliography", "open university"], feedback, action: "Check referencing against previous feedback." });
      if (f.includes("plan") || f.includes("review")) rules.push({ key: "plan-review", terms: ["plan", "review", "date"], feedback, action: "Check plans include clear dates or review points where relevant." });
      const keywords = feedbackKeywords(feedback);
      if (keywords.length >= 2) rules.push({ key: `keywords-${keywords.join("-").slice(0, 50)}`, terms: keywords, feedback, action: item.action || "Check whether this previous feedback applies." });
    });
    return dedupeRules(rules);
  }

  function feedbackKeywords(text) {
    const stop = new Set("about above after again all also and are because been before being between both can check could did does doing done each for from had has have here into just like make may need needs only point same should that the their them then there these this those through tutor used using when where which with wording would your".split(" "));
    return [...new Set(norm(text).split(/\s+/).filter(w => w.length > 4 && !stop.has(w)))].slice(0, 5);
  }

  function dedupeRules(rules) {
    const seen = new Set();
    return rules.filter(rule => {
      const key = `${rule.key}|${rule.feedback}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function ruleFind(draft, rule) {
    const nd = ` ${norm(draft)} `;
    if (rule.key.startsWith("keywords-")) {
      const hits = rule.terms.filter(term => nd.includes(norm(term)));
      return hits.length >= Math.min(2, rule.terms.length) ? hits.join(", ") : "";
    }
    const term = rule.terms.find(t => nd.includes(norm(t)) || nd.includes(t));
    return term || "";
  }

  function renderResults(results) {
    const root = document.getElementById("feedbackCheckResults");
    if (!root) return;
    if (!results.length) {
      root.className = "feedback-results feedback-empty";
      root.textContent = "No obvious feedback risks found from the selected records.";
      return;
    }
    if (results[0]?.type === "empty") {
      root.className = "feedback-results feedback-empty";
      root.textContent = results[0].message;
      return;
    }
    root.className = "feedback-results";
    root.innerHTML = results.slice(0, 40).map(result => `<article class="feedback-result-card">
      <strong>${esc(result.rule.action)}</strong>
      <p class="feedback-meta">Matched: ${esc(result.hit)} • From ${esc(result.record.module)} / ${esc(result.record.tma)} / ${esc(CATEGORY_LABELS[result.record.category] || result.record.category)}</p>
      <p class="feedback-excerpt">Previous feedback: ${esc(result.rule.feedback)}</p>
      <div class="feedback-actions"><button class="ghost" type="button" data-copy-feedback-action="${esc(result.rule.action)}">Copy action</button><button class="ghost" type="button" data-dismiss-feedback-result>Dismiss</button></div>
    </article>`).join("");
    root.querySelectorAll("[data-copy-feedback-action]").forEach(button => button.addEventListener("click", () => copyText(button.dataset.copyFeedbackAction)));
    root.querySelectorAll("[data-dismiss-feedback-result]").forEach(button => button.addEventListener("click", () => button.closest(".feedback-result-card")?.classList.add("is-resolved")));
  }

  function exportLibrary() {
    const data = { version: 1, exportedAt: new Date().toISOString(), repoPath: "feedback-markup/library/feedback-index.json", ...getState() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importLibrary(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    const state = getState();
    const imported = Array.isArray(parsed.records) ? parsed.records : Array.isArray(parsed) ? parsed : [];
    const existing = new Set(state.records.map(r => r.id));
    imported.forEach(r => state.records.push(existing.has(r.id) ? { ...r, id: uid() } : r));
    setState(state);
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", insertPanel);
  insertPanel();
})();
