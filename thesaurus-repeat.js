(() => {
  if (window.__tmazingThesaurusRepeatLoaded) return;
  window.__tmazingThesaurusRepeatLoaded = true;

  const DISMISS_KEY = "tmazing-dismissed-repeated-words-v1";
  const STOP_WORDS = new Set(`a an and are as at be because been but by can could did do does for from had has have he her hers him his i if in into is it its me my of on or our ours she so than that the their them then there these they this to was we were what when where which who why with would you your yours` .split(/\s+/));
  const THESAURUS = {
    important: ["significant", "central", "notable", "meaningful", "key"],
    shows: ["suggests", "indicates", "demonstrates", "highlights", "reveals"],
    show: ["suggest", "indicate", "demonstrate", "highlight", "reveal"],
    says: ["states", "argues", "suggests", "explains", "notes"],
    said: ["stated", "argued", "suggested", "explained", "noted"],
    argue: ["suggest", "claim", "propose", "maintain", "contend"],
    argues: ["suggests", "claims", "proposes", "maintains", "contends"],
    suggests: ["indicates", "implies", "points to", "proposes", "raises"],
    suggests: ["indicates", "implies", "points to", "proposes", "raises"],
    because: ["as", "since", "given that", "due to"],
    however: ["however", "nevertheless", "yet", "in contrast", "on the other hand"],
    also: ["also", "furthermore", "additionally", "as well", "in addition"],
    children: ["young people", "children", "minors", "younger learners"],
    child: ["young person", "child", "minor"],
    development: ["growth", "change", "progression", "maturation"],
    impact: ["effect", "influence", "consequence", "outcome"],
    affects: ["influences", "shapes", "changes", "impacts"],
    different: ["distinct", "varied", "separate", "contrasting"],
    similar: ["comparable", "alike", "related", "parallel"],
    good: ["effective", "useful", "strong", "positive"],
    bad: ["limited", "problematic", "weak", "negative"],
    big: ["large", "substantial", "major", "considerable"],
    small: ["limited", "minor", "narrow", "modest"],
    use: ["apply", "draw on", "employ", "make use of"],
    uses: ["applies", "draws on", "employs", "makes use of"],
    using: ["applying", "drawing on", "employing", "making use of"],
    make: ["create", "produce", "form", "build"],
    makes: ["creates", "produces", "forms", "builds"],
    clear: ["evident", "apparent", "explicit", "clear"],
    link: ["connection", "relationship", "association", "link"],
    linked: ["connected", "associated", "related", "linked"],
    example: ["case", "illustration", "instance", "example"],
    examples: ["cases", "illustrations", "instances", "examples"],
    focus: ["emphasis", "attention", "focus", "priority"],
    support: ["help", "assistance", "backing", "support"],
    evidence: ["supporting material", "evidence", "data", "example"],
    point: ["argument", "idea", "claim", "point"],
    idea: ["concept", "argument", "view", "idea"],
    role: ["function", "part", "role", "position"],
    research: ["study", "evidence", "research", "investigation"],
    study: ["research", "investigation", "study", "analysis"],
    explain: ["set out", "clarify", "explain", "account for"],
    explains: ["sets out", "clarifies", "explains", "accounts for"],
    therefore: ["therefore", "as a result", "consequently", "for this reason"],
    people: ["individuals", "people", "groups", "participants"],
    society: ["community", "society", "social context", "wider culture"],
    change: ["shift", "development", "change", "transition"],
    changing: ["shifting", "developing", "changing", "transitioning"],
    behaviour: ["actions", "conduct", "behaviour", "responses"],
    behavior: ["actions", "conduct", "behavior", "responses"],
    needs: ["requires", "needs", "calls for", "depends on"],
    need: ["require", "need", "call for", "depend on"],
    helps: ["supports", "helps", "assists", "enables"],
    help: ["support", "assist", "enable", "help"],
    thing: ["factor", "issue", "point", "element"],
    things: ["factors", "issues", "points", "elements"],
    way: ["method", "approach", "way", "process"],
    ways: ["methods", "approaches", "ways", "processes"],
    less: ["less", "reduced", "lower", "more limited"],
    more: ["more", "greater", "further", "additional"],
    many: ["many", "several", "numerous", "multiple"],
    often: ["frequently", "often", "commonly", "regularly"],
    same: ["same", "identical", "equivalent", "unchanged"],
    issue: ["problem", "concern", "question", "issue"],
    issues: ["problems", "concerns", "questions", "issues"],
  };

  function byId(id) { return document.getElementById(id); }
  function norm(value) { return String(value || "").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ").trim(); }
  function esc(value) { return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function readDismissed() {
    try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]")); }
    catch { return new Set(); }
  }
  function writeDismissed(set) { localStorage.setItem(DISMISS_KEY, JSON.stringify([...set].sort())); }

  function rootWord(word) {
    const w = norm(word);
    if (w.length > 5 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
    if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }

  function tokenise(text) {
    return String(text || "").match(/[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'-]*/g) || [];
  }

  function countWords(text) {
    const dismissed = readDismissed();
    const map = new Map();
    tokenise(text).forEach(word => {
      const n = rootWord(word);
      if (n.length < 5 || STOP_WORDS.has(n) || dismissed.has(n)) return;
      if (!map.has(n)) map.set(n, { word: n, count: 0, forms: new Set() });
      const item = map.get(n);
      item.count += 1;
      item.forms.add(word);
    });
    return [...map.values()].filter(item => item.count >= 4).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, 14);
  }

  function suggestionsFor(word) {
    const base = rootWord(word);
    if (THESAURUS[base]) return THESAURUS[base];
    const foundKey = Object.keys(THESAURUS).find(key => key.startsWith(base) || base.startsWith(key));
    return foundKey ? THESAURUS[foundKey] : [];
  }

  function ensurePanel() {
    if (byId("wordReviewPanel")) return;
    const checker = byId("checker");
    if (!checker) return;
    const panel = document.createElement("section");
    panel.id = "wordReviewPanel";
    panel.className = "reference-word-panel";
    panel.innerHTML = `
      <div class="section-head compact">
        <div>
          <h3>Repeated words + thesaurus</h3>
          <p class="help-text">Find words that appear a lot in your draft. Dismiss anything that is intentional.</p>
        </div>
        <button id="refreshWordReview" class="ghost" type="button">Refresh words</button>
      </div>
      <div class="word-review-grid">
        <div>
          <h4>Frequent words</h4>
          <div id="repeatedWordList" class="repeated-word-list empty-box">Paste a draft to see repeated words.</div>
        </div>
        <div class="thesaurus-box">
          <h4>Thesaurus lookup</h4>
          <div class="thesaurus-controls">
            <input id="thesaurusInput" type="search" placeholder="Type a word...">
            <button id="lookupThesaurus" class="ghost" type="button">Look up</button>
          </div>
          <div id="thesaurusResult" class="thesaurus-result empty-box">Choose a repeated word or search manually.</div>
        </div>
      </div>`;
    const generated = checker.querySelector(".generated-work");
    if (generated) checker.insertBefore(panel, generated);
    else checker.appendChild(panel);
    byId("refreshWordReview")?.addEventListener("click", renderWordReview);
    byId("lookupThesaurus")?.addEventListener("click", () => renderThesaurus(byId("thesaurusInput")?.value || ""));
    byId("thesaurusInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        renderThesaurus(event.currentTarget.value);
      }
    });
  }

  function renderThesaurus(word) {
    const result = byId("thesaurusResult");
    if (!result) return;
    const n = rootWord(word);
    const suggestions = suggestionsFor(n);
    if (!n) {
      result.className = "thesaurus-result empty-box";
      result.textContent = "Type a word to look up alternatives.";
      return;
    }
    if (!suggestions.length) {
      result.className = "thesaurus-result empty-box";
      result.innerHTML = `<strong>${esc(n)}</strong><br>No built-in suggestions yet. Add your own wording choice manually in your draft.`;
      return;
    }
    result.className = "thesaurus-result";
    result.innerHTML = `<strong>${esc(n)}</strong><div class="synonym-row">${suggestions.map(s => `<button type="button" class="synonym-chip" data-copy="${esc(s)}">${esc(s)}</button>`).join("")}</div><p class="help-text">Click a suggestion to copy it.</p>`;
    result.querySelectorAll("[data-copy]").forEach(button => {
      button.addEventListener("click", () => navigator.clipboard?.writeText(button.dataset.copy || button.textContent || ""));
    });
  }

  function renderWordReview() {
    ensurePanel();
    const list = byId("repeatedWordList");
    if (!list) return;
    const draft = byId("draftInput")?.value || state?.draft || "";
    const words = countWords(draft);
    if (!draft.trim()) {
      list.className = "repeated-word-list empty-box";
      list.textContent = "Paste a draft to see repeated words.";
      return;
    }
    if (!words.length) {
      list.className = "repeated-word-list empty-box";
      list.textContent = "No repeated words above the threshold, or they have all been dismissed.";
      return;
    }
    list.className = "repeated-word-list";
    list.innerHTML = words.map(item => {
      const suggestions = suggestionsFor(item.word);
      return `<article class="repeated-word-card" data-word="${esc(item.word)}">
        <div class="repeated-word-head"><strong>${esc(item.word)}</strong><span class="word-count-chip">${item.count}</span></div>
        <p class="help-text">Forms: ${esc([...item.forms].slice(0, 5).join(", "))}</p>
        ${suggestions.length ? `<div class="synonym-row">${suggestions.slice(0, 6).map(s => `<button type="button" class="synonym-chip" data-copy="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : `<p class="help-text">No built-in alternatives yet.</p>`}
        <div class="word-actions"><button type="button" class="ghost" data-lookup="${esc(item.word)}">Look up</button><button type="button" class="ghost" data-dismiss="${esc(item.word)}">Dismiss</button></div>
      </article>`;
    }).join("");
    list.querySelectorAll("[data-dismiss]").forEach(button => {
      button.addEventListener("click", () => {
        const set = readDismissed();
        set.add(rootWord(button.dataset.dismiss));
        writeDismissed(set);
        renderWordReview();
      });
    });
    list.querySelectorAll("[data-lookup]").forEach(button => {
      button.addEventListener("click", () => {
        const input = byId("thesaurusInput");
        if (input) input.value = button.dataset.lookup || "";
        renderThesaurus(button.dataset.lookup || "");
      });
    });
    list.querySelectorAll("[data-copy]").forEach(button => {
      button.addEventListener("click", () => navigator.clipboard?.writeText(button.dataset.copy || button.textContent || ""));
    });
  }

  function patchAnalyse() {
    if (!window.analyseDraft || window.__tmazingAnalyseWordPatch) return;
    window.__tmazingAnalyseWordPatch = true;
    const original = window.analyseDraft;
    window.analyseDraft = function patchedAnalyseDraft(...args) {
      const result = original.apply(this, args);
      setTimeout(renderWordReview, 0);
      return result;
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensurePanel();
    patchAnalyse();
    renderWordReview();
    byId("draftInput")?.addEventListener("input", () => setTimeout(renderWordReview, 120));
  });

  ensurePanel();
  patchAnalyse();
  renderWordReview();
})();
