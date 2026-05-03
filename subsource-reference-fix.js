(() => {
  if (window.__tmazingSubSourceReferenceFixLoaded) return;
  window.__tmazingSubSourceReferenceFixLoaded = true;

  const oldHarvardRef = window.harvardRef;
  const oldInlineCitation = window.inlineCitation;
  const oldHarvardSort = window.harvardSort;

  const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()"']+/gi;
  const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function esc(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function normaliseUrl(value) {
    let url = clean(value).replace(/[),.;:]+$/g, "");
    if (url.startsWith("www.")) url = `https://${url}`;
    return url;
  }

  function norm(value) {
    return String(value || "").toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function stripStop(value) {
    return clean(value).replace(/[.。]+$/g, "");
  }

  function year(source) {
    const raw = clean(source?.year);
    if (!raw || /^(n\.?d\.?|no date)$/i.test(raw)) return "no date";
    return raw;
  }

  function accessDate(source) {
    const raw = clean(source?.accessed || source?.accessDate);
    if (!raw) return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }
    return raw;
  }

  function quote(value) {
    return `‘${stripStop(value || "Untitled source")}’`;
  }

  function authorParts(authorString) {
    return clean(authorString).split(/\s+and\s+|;/i).map(clean).filter(Boolean);
  }

  function isCorporateAuthor(value) {
    const v = clean(value);
    if (!v) return false;
    return /\b(open university|university|library|society|association|council|department|government|nhs|unesco|unicef|organisation|organization|centre|center|institute|office|service|services|college|school|charity|trust|authority|foundation|group|parliament|house of commons)\b/i.test(v) || (/^[A-Z0-9&\s.-]{3,}$/.test(v) && !v.includes(","));
  }

  function surname(part) {
    const p = clean(part);
    if (!p) return "Unknown author";
    if (isCorporateAuthor(p)) return p;
    if (p.includes(",")) return p.split(",")[0].trim();
    const bits = p.split(/\s+/).filter(Boolean);
    return bits[bits.length - 1] || p;
  }

  function citationName(source) {
    const authors = clean(source?.authors);
    if (!authors) return stripStop(source?.title || "Unknown author");
    const parts = authorParts(authors);
    if (parts.length === 1) return surname(parts[0]);
    if (parts.length === 2) return `${surname(parts[0])} and ${surname(parts[1])}`;
    return `${surname(parts[0])} et al.`;
  }

  function isOUUrl(url) {
    return /learn2\.open\.ac\.uk|open\.ac\.uk\/mod\/oucontent|\/oucontent\//i.test(url || "");
  }

  function sourceByIdSafe(sourceId) {
    return typeof sourceById === "function" ? sourceById(sourceId) : state.sources.find(s => s.id === sourceId);
  }

  function parentOf(source) {
    return source?.parentSourceId ? sourceByIdSafe(source.parentSourceId) : null;
  }

  function moduleTitle(source) {
    const parent = parentOf(source);
    const module = clean(source?.module || parent?.module);
    const title = clean(parent?.publisher || source?.publisher || parent?.moduleTitle || parent?.title || "Module material");
    if (module && title && title !== module) return `${module}: ${stripStop(title)}`;
    return module || stripStop(title);
  }

  function refLocator(locator, source) {
    const loc = clean(locator);
    if (!loc) return "";
    if (source?.parentSourceId && (loc === source.unit || loc === source.parentSubheading || /^activity\s|^topic\s|^\d+(\.\d+)*\s/i.test(loc))) return "";
    if (/^(p\.|pp\.|para\.|paragraph)/i.test(loc)) return loc.replace(/^paragraph\s+/i, "para. ").replace(/^paragraphs\s+/i, "paras. ");
    return loc;
  }

  function subSourceHarvard(source, suffix = "") {
    const url = clean(source.url);
    const access = url ? ` Available at: ${url} (Accessed: ${accessDate(source)}).` : "";
    const title = stripStop(source.title || source.unit || "Untitled source");
    const y = `${year(source)}${suffix}`;

    if (isOUUrl(url) || source.sourceType === "module") {
      const author = clean(source.authors) || "The Open University";
      return `${author} (${y}) ${quote(title)}. ${moduleTitle(source)}.${access}`.replace(/\s+/g, " ").trim();
    }

    const author = clean(source.authors) || clean(source.publisher) || stripStop(title) || "Unknown author";
    return `${author} (${y}) ${title}.${access}`.replace(/\s+/g, " ").trim();
  }

  function subSourceInline(source, locator = "", suffix = "") {
    const loc = refLocator(locator, source);
    return `(${citationName(source)}, ${year(source)}${suffix}${loc ? `, ${loc}` : ""})`;
  }

  function parseLines(text) {
    return String(text || "").split(/\n+/).map(line => line.trim());
  }

  function isHeading(line) {
    const text = clean(line.replace(URL_RE, " ").replace(DOI_RE, " "));
    if (!text || text.length > 135) return false;
    if (/^Topic\s+\d+\s*:/i.test(text)) return true;
    if (/^\d+(?:\.\d+)*\s+\S/.test(text)) return true;
    if (/^Activity\s+\d+(?:\.\d+)*\b/i.test(text)) return true;
    if (/^Block\s+\d+\s+Skills\s+activity\s+\d+/i.test(text)) return true;
    if (/^[A-Z]\.?\s+The\s+social\s+science\s+critique/i.test(text)) return true;
    if (/^(references|reference list|bibliography|further reading|sources|external links|links|resources|feedback|answer|conclusion)$/i.test(text)) return true;
    return false;
  }

  function parseParentheticalReference(line, rawUrl) {
    const raw = String(line || "");
    const urlIndex = raw.indexOf(rawUrl);
    const beforeUrl = urlIndex >= 0 ? raw.slice(0, urlIndex) : raw;
    const openParen = beforeUrl.lastIndexOf("(");
    if (openParen < 0) return null;
    const beforeParen = clean(beforeUrl.slice(0, openParen)).replace(/[,:;\-–—\s]+$/g, "");
    const inside = clean(beforeUrl.slice(openParen + 1)).replace(/[,:;\-–—\s]+$/g, "");
    const label = clean(inside.split(/:/)[0]);
    if (!label || label.length > 100) return null;
    return { title: beforeParen || label, author: label };
  }

  function parseInlineLink(parent, url) {
    const lines = parseLines(parent?.text || "");
    let currentHeading = parent?.unit || parent?.title || "Further sources";
    const target = normaliseUrl(url).toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isHeading(line)) currentHeading = clean(line.replace(URL_RE, " ").replace(DOI_RE, " "));
      const urls = [...line.matchAll(URL_RE)].map(m => normaliseUrl(m[0]));
      if (!urls.some(found => found.toLowerCase() === target)) continue;
      const rawUrl = urls.find(found => found.toLowerCase() === target) || url;
      const parenthetical = parseParentheticalReference(line, rawUrl);
      const context = clean(lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(" ")).slice(0, 850);
      if (parenthetical) {
        return {
          title: parenthetical.title,
          authors: parenthetical.author,
          subheading: currentHeading,
          note: context
        };
      }
      const cleanLine = clean(line.replace(URL_RE, " ").replace(DOI_RE, " ")).replace(/[,:;\-–—\s]+$/g, "");
      return {
        title: cleanLine || currentHeading,
        authors: isOUUrl(rawUrl) ? "The Open University" : "",
        subheading: currentHeading,
        note: context
      };
    }
    return null;
  }

  function fixExistingSubSources() {
    if (!Array.isArray(state?.sources)) return false;
    let changed = false;
    state.sources.forEach(source => {
      if (!source.parentSourceId) return;
      const parent = parentOf(source);
      if (!parent) return;
      const parsed = parseInlineLink(parent, source.url || "");
      if (parsed) {
        if (parsed.subheading && source.parentSubheading !== parsed.subheading) { source.parentSubheading = parsed.subheading; changed = true; }
        if (parsed.subheading && source.unit !== parsed.subheading) { source.unit = parsed.subheading; changed = true; }
        if (parsed.title && source.title !== parsed.title) { source.title = parsed.title; changed = true; }
        if (parsed.authors && source.authors !== parsed.authors) { source.authors = parsed.authors; changed = true; }
        if (parsed.note && source.text !== parsed.note) { source.text = parsed.note; changed = true; }
        source.segments = [{
          id: source.segments?.[0]?.id || id(),
          location: parsed.subheading || source.unit || "Sub-source",
          citationLocator: "",
          text: parsed.note || source.text || source.url || ""
        }];
        changed = true;
      }
      if (isOUUrl(source.url)) {
        if (source.sourceType !== "module") { source.sourceType = "module"; changed = true; }
        if (!source.authors || /learn2\.open\.ac\.uk/i.test(source.authors)) { source.authors = "The Open University"; changed = true; }
        if ((!source.year || /^no date$/i.test(source.year)) && parent.year) { source.year = parent.year; changed = true; }
        if (!source.publisher && parent.publisher) { source.publisher = parent.publisher; changed = true; }
      } else {
        if (source.sourceType !== "webpage") { source.sourceType = "webpage"; changed = true; }
        if (!source.year) { source.year = "no date"; changed = true; }
      }
      if (source.fileType !== "sub-source from main source") { source.fileType = "sub-source from main source"; changed = true; }
    });
    if (changed) save();
    return changed;
  }

  function displayedListForCurrentFilters() {
    const q = norm(document.getElementById("librarySearch")?.value || "");
    const mod = document.getElementById("moduleFilter")?.value || "";
    return state.sources.filter(s => (!mod || s.module === mod) && (!q || sourceHaystack(s).includes(q)));
  }

  function removeTopLevelSubSourceCards() {
    const library = document.getElementById("sourceLibrary");
    if (!library) return;
    const cards = [...library.querySelectorAll(":scope > .source-card")];
    const list = displayedListForCurrentFilters();
    cards.forEach((card, index) => {
      const source = list[index];
      if (source?.parentSourceId) card.remove();
    });
  }

  function patchReferences() {
    window.harvardRef = function harvardRefPatched(source, suffix = "") {
      if (source?.parentSourceId) return subSourceHarvard(source, suffix);
      return oldHarvardRef ? oldHarvardRef(source, suffix) : `${clean(source?.authors) || "Unknown author"} (${year(source)}${suffix}) ${stripStop(source?.title || "Untitled source")}.`;
    };

    window.inlineCitation = function inlineCitationPatched(source, locator = "", suffix = "") {
      if (source?.parentSourceId) return subSourceInline(source, locator, suffix);
      return oldInlineCitation ? oldInlineCitation(source, locator, suffix) : `(${citationName(source)}, ${year(source)}${suffix})`;
    };

    window.harvardSort = function harvardSortPatched(source) {
      if (source?.parentSourceId) return `${clean(source.authors) || clean(source.title)} ${year(source)} ${clean(source.title)}`.toLowerCase();
      return oldHarvardSort ? oldHarvardSort(source) : `${clean(source?.authors)} ${year(source)} ${clean(source?.title)}`.toLowerCase();
    };

    window.renderCitedDraft = function renderCitedDraftSubSourcePatched() {
      const text = state.draft || els.draftInput.value || "";
      if (!text) {
        els.citedDraft.value = "";
        els.bibliography.className = "bibliography empty-box";
        els.bibliography.textContent = "No selected citations yet.";
        return;
      }
      const cites = state.citations.filter(c => sourceByIdSafe(c.sourceId) && c.end <= text.length).sort((a, b) => b.end - a.end);
      const suffixMap = buildSuffixMapLocal(cites);
      let out = text;
      cites.forEach(c => {
        const source = sourceByIdSafe(c.sourceId);
        out = out.slice(0, c.end) + ` ${window.inlineCitation(source, c.locator, suffixMap.get(source.id) || "")}` + out.slice(c.end);
      });
      els.citedDraft.value = out;
      const refs = [...new Map(cites.map(c => [c.sourceId, sourceByIdSafe(c.sourceId)])).values()].filter(Boolean).sort((a, b) => window.harvardSort(a).localeCompare(window.harvardSort(b)));
      if (!refs.length) {
        els.bibliography.className = "bibliography empty-box";
        els.bibliography.textContent = "No selected citations yet.";
        return;
      }
      els.bibliography.className = "bibliography";
      els.bibliography.innerHTML = refs.map(s => `<p>${esc(window.harvardRef(s, suffixMap.get(s.id) || ""))}</p>`).join("");
    };
  }

  function buildSuffixMapLocal(cites) {
    const firstPosition = new Map();
    cites.slice().reverse().forEach(c => {
      const source = sourceByIdSafe(c.sourceId);
      if (source && !firstPosition.has(c.sourceId)) firstPosition.set(c.sourceId, c.start ?? 0);
    });
    const refs = [...new Map(cites.map(c => [c.sourceId, sourceByIdSafe(c.sourceId)])).values()].filter(Boolean);
    const groups = new Map();
    refs.forEach(source => {
      const key = `${citationName(source)}|${year(source)}`.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(source);
    });
    const map = new Map();
    groups.forEach(list => {
      if (list.length < 2) return;
      list.sort((a, b) => (firstPosition.get(a.id) ?? 999999) - (firstPosition.get(b.id) ?? 999999) || window.harvardSort(a).localeCompare(window.harvardSort(b)));
      list.forEach((source, index) => map.set(source.id, String.fromCharCode(97 + index)));
    });
    return map;
  }

  function patchRenderLibrary() {
    if (window.__tmazingSubSourceRenderPatch) return;
    window.__tmazingSubSourceRenderPatch = true;
    const original = renderLibrary;
    renderLibrary = function renderLibraryWithoutTopLevelSubSources(...args) {
      fixExistingSubSources();
      const result = original.apply(this, args);
      requestAnimationFrame(removeTopLevelSubSourceCards);
      setTimeout(removeTopLevelSubSourceCards, 80);
      return result;
    };
  }

  function run() {
    fixExistingSubSources();
    patchReferences();
    patchRenderLibrary();
    removeTopLevelSubSourceCards();
    if (typeof renderLibrary === "function") renderLibrary();
    if (typeof renderCitedDraft === "function") renderCitedDraft();
  }

  document.addEventListener("DOMContentLoaded", run);
  setTimeout(run, 0);
})();
