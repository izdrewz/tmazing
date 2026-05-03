(() => {
  if (window.__tmazingSourceOverlapLoaded) return;
  window.__tmazingSourceOverlapLoaded = true;

  const DISMISS_KEY = "tmazing-dismissed-source-overlaps-v1";
  const STOP = new Set("a an and are as at be been being but by can could did do does for from had has have he her hers him his i if in into is it its me my of on or our ours she so than that the their them then there these they this to was we were what when where which who why with would you your yours".split(" "));

  function byId(id) { return document.getElementById(id); }
  function esc(value) { return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function norm(value) { return String(value || "").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ").trim(); }
  function words(value) { return norm(value).split(/\s+/).filter(Boolean); }
  function contentWords(value) { return words(value).filter(w => w.length > 3 && !STOP.has(w)); }
  function keyFor(issue) { return `${issue.type}|${issue.source.id}|${issue.segment.location}|${norm(issue.phrase).slice(0, 80)}`; }
  function readDismissed() { try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]")); } catch { return new Set(); } }
  function writeDismissed(set) { localStorage.setItem(DISMISS_KEY, JSON.stringify([...set])); }

  function splitDraft(text) {
    const pieces = [];
    const re = /[^.!?\n]+[.!?]?/g;
    let m;
    while ((m = re.exec(text))) {
      const raw = m[0];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const leading = raw.indexOf(trimmed);
      const start = m.index + Math.max(0, leading);
      pieces.push({ text: trimmed, start, end: start + trimmed.length });
    }
    return pieces;
  }

  function ngrams(list, min = 8, max = 14) {
    const out = [];
    for (let len = Math.min(max, list.length); len >= min; len--) {
      for (let i = 0; i <= list.length - len; i++) out.push(list.slice(i, i + len).join(" "));
    }
    return out;
  }

  function snippetAround(text, phrase) {
    const nText = norm(text);
    const nPhrase = norm(phrase);
    let pos = nText.indexOf(nPhrase);
    if (pos < 0) pos = 0;
    const raw = String(text || "");
    const start = Math.max(0, pos - 90);
    const end = Math.min(raw.length, pos + phrase.length + 120);
    return `${start > 0 ? "…" : ""}${esc(raw.slice(start, end))}${end < raw.length ? "…" : ""}`;
  }

  function hasNearbyCitation(sentence) {
    const cites = Array.isArray(state?.citations) ? state.citations : [];
    return cites.some(c => c.start >= sentence.start - 20 && c.start <= sentence.end + 120);
  }

  function overlapScore(aWords, bWords) {
    const a = new Set(aWords);
    const b = new Set(bWords);
    if (!a.size || !b.size) return 0;
    let hit = 0;
    a.forEach(w => { if (b.has(w)) hit++; });
    return hit / Math.min(a.size, b.size);
  }

  function detectIssues() {
    const draft = byId("draftInput")?.value || state?.draft || "";
    const sentences = splitDraft(draft).filter(s => contentWords(s.text).length >= 7);
    const dismissed = readDismissed();
    const issues = [];
    const sources = Array.isArray(state?.sources) ? state.sources : [];

    sentences.forEach(sentence => {
      const sWords = contentWords(sentence.text);
      const sNorm = norm(sentence.text);
      let bestExact = null;

      sources.forEach(source => {
        (source.segments || []).slice(0, 400).forEach(segment => {
          const segNorm = norm(segment.text || "");
          if (!segNorm) return;

          const exact = ngrams(words(sentence.text), 8, 14).find(phrase => segNorm.includes(phrase));
          if (exact) {
            const issue = {
              type: "exact",
              severity: "High",
              phrase: exact,
              sentence,
              source,
              segment,
              snippet: snippetAround(segment.text, exact),
              cited: hasNearbyCitation(sentence)
            };
            if (!dismissed.has(keyFor(issue))) bestExact = issue;
            return;
          }

          if (!bestExact && sWords.length >= 10) {
            const score = overlapScore(sWords, contentWords(segment.text));
            if (score >= .72 && segNorm.length > 80 && sNorm.length > 70) {
              const issue = {
                type: "similar",
                severity: score >= .84 ? "High" : "Medium",
                phrase: sentence.text.slice(0, 140),
                sentence,
                source,
                segment,
                score,
                snippet: snippetAround(segment.text, sentence.text.slice(0, 80)),
                cited: hasNearbyCitation(sentence)
              };
              if (!dismissed.has(keyFor(issue))) issues.push(issue);
            }
          }
        });
      });
      if (bestExact) issues.push(bestExact);
    });

    const unique = new Map();
    issues.forEach(issue => {
      const key = `${issue.sentence.start}|${issue.source.id}|${issue.segment.location}|${issue.type}`;
      if (!unique.has(key)) unique.set(key, issue);
    });
    return [...unique.values()].sort((a, b) => {
      const severity = { High: 0, Medium: 1, Low: 2 };
      return severity[a.severity] - severity[b.severity] || a.sentence.start - b.sentence.start;
    }).slice(0, 18);
  }

  function ensurePanel() {
    if (byId("sourceOverlapPanel")) return;
    const checker = byId("checker");
    if (!checker) return;
    const panel = document.createElement("section");
    panel.id = "sourceOverlapPanel";
    panel.className = "source-overlap-panel";
    panel.innerHTML = `
      <div class="section-head compact">
        <div>
          <h3>Source overlap / plagiarism risk</h3>
          <p class="help-text">Checks your draft against sources you have added to this hub. It flags close source overlap, especially uncited exact wording.</p>
        </div>
        <button id="refreshSourceOverlap" class="ghost" type="button">Check overlap</button>
      </div>
      <div id="sourceOverlapList" class="source-overlap-list empty-box">Paste a draft and add sources, then run the check.</div>`;
    const wordPanel = byId("wordReviewPanel");
    if (wordPanel) wordPanel.insertAdjacentElement("afterend", panel);
    else checker.appendChild(panel);
    byId("refreshSourceOverlap")?.addEventListener("click", renderOverlap);
  }

  function addIssueCitation(issue) {
    if (typeof addCitation === "function") {
      addCitation(issue.sentence.start, issue.sentence.end, issue.source.id, issue.segment.citationLocator || issue.segment.location || "");
      renderOverlap();
    }
  }

  function dismissIssue(issue) {
    const set = readDismissed();
    set.add(keyFor(issue));
    writeDismissed(set);
    renderOverlap();
  }

  function renderOverlap() {
    ensurePanel();
    const box = byId("sourceOverlapList");
    if (!box) return;
    const draft = byId("draftInput")?.value || state?.draft || "";
    if (!draft.trim()) {
      box.className = "source-overlap-list empty-box";
      box.textContent = "Paste a draft to check source overlap.";
      return;
    }
    if (!state?.sources?.length) {
      box.className = "source-overlap-list empty-box";
      box.textContent = "Add sources first. This checker compares your draft with sources saved in the Uni Hub only.";
      return;
    }
    const issues = detectIssues();
    if (!issues.length) {
      box.className = "source-overlap-list empty-box";
      box.textContent = "No high source-overlap risks found against your saved sources.";
      return;
    }
    box.className = "source-overlap-list";
    box.innerHTML = issues.map((issue, index) => `<article class="source-overlap-card ${issue.cited ? "is-cited" : "needs-cite"}" data-overlap-index="${index}">
      <div class="overlap-head"><strong>${issue.severity} ${issue.type === "exact" ? "exact wording" : "similar wording"}</strong><span>${issue.cited ? "citation nearby" : "citation needed"}</span></div>
      <p class="overlap-draft"><mark>${esc(issue.sentence.text)}</mark></p>
      <p class="source-meta">Matched: ${esc(issue.source.title)} • ${esc(issue.source.module || "")} • ${esc(issue.source.unit || "")} • ${esc(issue.segment.location || "")}</p>
      <div class="snippet">${issue.snippet}</div>
      <div class="source-actions"><button type="button" data-overlap-cite="${index}">Add citation</button><button type="button" class="ghost" data-overlap-dismiss="${index}">Dismiss</button><button type="button" class="ghost" data-overlap-view="${index}">View source area</button></div>
    </article>`).join("");
    box.querySelectorAll("[data-overlap-cite]").forEach(button => button.addEventListener("click", () => addIssueCitation(issues[Number(button.dataset.overlapCite)])));
    box.querySelectorAll("[data-overlap-dismiss]").forEach(button => button.addEventListener("click", () => dismissIssue(issues[Number(button.dataset.overlapDismiss)])));
    box.querySelectorAll("[data-overlap-view]").forEach(button => button.addEventListener("click", () => {
      const issue = issues[Number(button.dataset.overlapView)];
      alert(`${issue.source.title}\n${issue.segment.location}\n\n${issue.segment.text}`);
    }));
  }

  function patchAnalyse() {
    if (!window.analyseDraft || window.__tmazingOverlapAnalysePatch) return;
    window.__tmazingOverlapAnalysePatch = true;
    const original = window.analyseDraft;
    window.analyseDraft = function patchedAnalyseDraft(...args) {
      const result = original.apply(this, args);
      setTimeout(renderOverlap, 0);
      return result;
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensurePanel();
    patchAnalyse();
    renderOverlap();
    byId("draftInput")?.addEventListener("input", () => setTimeout(renderOverlap, 180));
  });

  ensurePanel();
  patchAnalyse();
  setTimeout(renderOverlap, 0);
})();
