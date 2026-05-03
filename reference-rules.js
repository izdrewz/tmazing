(() => {
  const SOURCE_TYPES = [
    ["module", "Online module material"],
    ["module-av", "Module video/audio"],
    ["forum", "Forum message"],
    ["book", "Book"],
    ["chapter", "Chapter in edited book"],
    ["journal", "Journal article"],
    ["newspaper", "Newspaper article"],
    ["webpage", "Web page"],
    ["image", "Online image"],
    ["other", "Other / manual"],
  ];

  const ORG_HINTS = /\b(open university|university|library|society|association|council|department|government|nhs|unesco|unicef|organisation|organization|centre|center|institute|office|service|services|college|school|charity|trust|authority|foundation)\b/i;

  function byId(id) { return document.getElementById(id); }

  function todayLong() {
    return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function stripTrailingFullStop(value) {
    return clean(value).replace(/[.。]+$/g, "");
  }

  function normaliseYear(value) {
    const year = clean(value);
    if (!year) return "no date";
    if (/^(n\.?d\.?|no date)$/i.test(year)) return "no date";
    return year;
  }

  function normaliseAccessDate(value) {
    const raw = clean(value);
    if (!raw) return todayLong();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }
    return raw;
  }

  function sourceType(source) {
    return source.sourceType || source.typeOfSource || inferType(source);
  }

  function inferType(source) {
    const hay = `${source.title || ""} ${source.publisher || ""} ${source.url || ""} ${source.fileType || ""}`.toLowerCase();
    if (/forum|discussion/.test(hay)) return "forum";
    if (/video|audio|recording|podcast/.test(hay)) return "module-av";
    if (/journal|article/.test(hay)) return "journal";
    if (/newspaper|guardian|times|bbc news/.test(hay)) return "newspaper";
    if (/image|photograph|photo|instagram/.test(hay)) return "image";
    if (/learn2\.open\.ac\.uk|oucontent|module|block|unit|topic|activity/.test(hay)) return "module";
    if (/chapter|edited/.test(hay)) return "chapter";
    if (/http|www\./.test(hay)) return "webpage";
    return "other";
  }

  function authorParts(authorString) {
    const raw = clean(authorString);
    if (!raw) return [];
    return raw.split(/\s+and\s+|;/i).map(clean).filter(Boolean);
  }

  function isCorporateAuthor(value) {
    const v = clean(value);
    if (!v) return false;
    if (ORG_HINTS.test(v)) return true;
    if (/^[A-Z0-9&\s.-]{3,}$/.test(v) && !v.includes(",")) return true;
    return false;
  }

  function citationSurname(part) {
    const p = clean(part);
    if (!p) return "Unknown author";
    if (isCorporateAuthor(p)) return p;
    if (p.includes(",")) return p.split(",")[0].trim();
    const words = p.split(/\s+/).filter(Boolean);
    return words[words.length - 1] || p;
  }

  function titleCitation(source) {
    return stripTrailingFullStop(source.title || "Untitled source");
  }

  function referenceAuthor(source) {
    const authors = clean(source.authors);
    if (authors) return authors;
    return titleCitation(source);
  }

  function citationNameFor(source) {
    const authors = clean(source.authors);
    if (!authors) return titleCitation(source);
    const parts = authorParts(authors);
    if (!parts.length) return titleCitation(source);
    if (parts.length === 1) return citationSurname(parts[0]);
    if (parts.length === 2) return `${citationSurname(parts[0])} and ${citationSurname(parts[1])}`;
    return `${citationSurname(parts[0])} et al.`;
  }

  function quoteTitle(title) {
    const t = stripTrailingFullStop(title || "Untitled source");
    return `‘${t}’`;
  }

  function titlePlain(title) {
    return stripTrailingFullStop(title || "Untitled source");
  }

  function addAvailable(source) {
    const url = clean(source.url);
    if (!url) return "";
    return ` Available at: ${url} (Accessed: ${normaliseAccessDate(source.accessed || source.accessDate)}).`;
  }

  function addPages(source) {
    const pages = clean(source.pages);
    if (!pages) return "";
    if (/^(p\.|pp\.|para\.|paragraph|section)/i.test(pages)) return ` ${pages}.`;
    return ` ${pages}.`;
  }

  function moduleTitle(source) {
    return stripTrailingFullStop(source.publisher || source.moduleTitle || source.module || "Module material");
  }

  function moduleCodeTitle(source) {
    const code = clean(source.module);
    const title = moduleTitle(source);
    if (code && title && title !== code) return `${code}: ${title}`;
    return code || title;
  }

  function makeHarvardRef(source, suffix = "") {
    const kind = sourceType(source);
    const author = referenceAuthor(source);
    const year = `${normaliseYear(source.year)}${suffix}`;
    const title = source.title || "Untitled source";
    const unit = clean(source.unit);
    const pub = stripTrailingFullStop(source.publisher);
    const urlBit = addAvailable(source);
    const pages = addPages(source);

    if (kind === "module" || kind === "module-av") {
      const creator = author || "The Open University";
      return `${creator} (${year}) ${quoteTitle(title)}. ${moduleCodeTitle(source)}.${urlBit}`.replace(/\s+/g, " ").trim();
    }

    if (kind === "forum") {
      const board = unit || "Module forum";
      return `${author} (${year}) ${quoteTitle(title)}, ${board}, in ${moduleCodeTitle(source)}.${urlBit}`.replace(/\s+/g, " ").trim();
    }

    if (kind === "book") {
      return `${author} (${year}) ${titlePlain(title)}.${pub ? ` ${pub}.` : ""}${urlBit}`.replace(/\s+/g, " ").trim();
    }

    if (kind === "chapter") {
      const book = pub || moduleTitle(source) || "Edited book";
      return `${author} (${year}) ${quoteTitle(title)}, in ${book}.${pages}${urlBit}`.replace(/\s+/g, " ").trim();
    }

    if (kind === "journal") {
      const journal = pub || "Journal title";
      return `${author} (${year}) ${quoteTitle(title)}, ${journal}.${pages}${urlBit}`.replace(/\s+/g, " ").trim();
    }

    if (kind === "newspaper") {
      const newspaper = pub || "Newspaper title";
      return `${author} (${year}) ${quoteTitle(title)}, ${newspaper}.${pages}${urlBit}`.replace(/\s+/g, " ").trim();
    }

    if (kind === "webpage") {
      const orgAuthor = author;
      return `${orgAuthor} (${year}) ${titlePlain(title)}.${urlBit}`.replace(/\s+/g, " ").trim();
    }

    if (kind === "image") {
      return `${author} (${year}) ${titlePlain(title)} [Image].${urlBit}`.replace(/\s+/g, " ").trim();
    }

    return `${author} (${year}) ${titlePlain(title)}.${pub ? ` ${pub}.` : ""}${pages}${urlBit}`.replace(/\s+/g, " ").trim();
  }

  function normaliseLocator(locator) {
    const loc = clean(locator);
    if (!loc) return "";
    return loc.replace(/^paragraph\s+/i, "para. ").replace(/^paragraphs\s+/i, "paras. ");
  }

  function makeInlineCitation(source, locator = "", suffix = "") {
    return `(${citationNameFor(source)}, ${normaliseYear(source.year)}${suffix}${normaliseLocator(locator) ? `, ${normaliseLocator(locator)}` : ""})`;
  }

  function sortKey(source) {
    return `${referenceAuthor(source).replace(/^the\s+/i, "")} ${normaliseYear(source.year)} ${source.title || ""}`.toLowerCase();
  }

  function buildSuffixMap(cites) {
    const firstPosition = new Map();
    cites.slice().reverse().forEach(c => {
      const source = sourceById(c.sourceId);
      if (source && !firstPosition.has(c.sourceId)) firstPosition.set(c.sourceId, c.start ?? 0);
    });
    const refs = [...new Map(cites.map(c => [c.sourceId, sourceById(c.sourceId)])).values()].filter(Boolean);
    const groups = new Map();
    refs.forEach(source => {
      const key = `${citationNameFor(source)}|${normaliseYear(source.year)}`.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(source);
    });
    const map = new Map();
    groups.forEach(list => {
      if (list.length < 2) return;
      list.sort((a, b) => (firstPosition.get(a.id) ?? 999999) - (firstPosition.get(b.id) ?? 999999) || sortKey(a).localeCompare(sortKey(b)));
      list.forEach((source, index) => map.set(source.id, String.fromCharCode(97 + index)));
    });
    return map;
  }

  function ensureReferenceFields() {
    const form = byId("sourceForm");
    if (!form || byId("sourceType")) return;

    const typeLabel = document.createElement("label");
    typeLabel.innerHTML = `Source type<select id="sourceType">${SOURCE_TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>`;

    const accessedLabel = document.createElement("label");
    accessedLabel.innerHTML = `Accessed date<input id="sourceAccessed" type="date">`;

    const authorInput = byId("sourceAuthors");
    if (authorInput) {
      authorInput.required = false;
      authorInput.placeholder = "Author, The Open University, organisation, or leave blank if no author";
    }

    const publisherInput = byId("sourcePublisher");
    if (publisherInput) publisherInput.placeholder = "Module title, publisher, journal, website, newspaper...";

    const urlInput = byId("sourceUrl");
    if (urlInput) urlInput.placeholder = "URL, DOI, or uploaded file note";

    const pagesInput = byId("sourcePages");
    if (pagesInput) pagesInput.placeholder = "p. 12, pp. 12–18, para. 3, section 2.1...";

    const yearInput = byId("sourceYear");
    if (yearInput) yearInput.placeholder = "2025 or no date";

    const publisherLabel = publisherInput?.closest("label");
    if (publisherLabel) publisherLabel.insertAdjacentElement("beforebegin", typeLabel);
    const urlLabel = urlInput?.closest("label");
    if (urlLabel) urlLabel.insertAdjacentElement("afterend", accessedLabel);

    const sourceText = byId("sourceText");
    const help = document.createElement("p");
    help.className = "help-text full-span";
    help.textContent = "References use Cite Them Right Harvard: in-text citation plus a References list. For module pages, use your module start year; use The Open University when there is no named author; add p./pp. or para. when quoting or using a precise page/paragraph.";
    sourceText?.closest("label")?.insertAdjacentElement("beforebegin", help);
  }

  function captureExtraFields() {
    const form = byId("sourceForm");
    if (!form || form.dataset.referenceRulesBound) return;
    form.dataset.referenceRulesBound = "true";
    form.addEventListener("submit", () => {
      const extra = {
        sourceType: byId("sourceType")?.value || "other",
        accessed: byId("sourceAccessed")?.value || "",
      };
      setTimeout(() => {
        const last = state.sources[state.sources.length - 1];
        if (!last) return;
        if (!last.sourceType) last.sourceType = extra.sourceType;
        if (!last.accessed) last.accessed = extra.accessed;
        if (!last.authors && (last.sourceType === "module" || last.sourceType === "module-av")) last.authors = "The Open University";
        save();
        renderLibrary();
        renderCitedDraft();
      }, 0);
    }, true);
  }

  function renameBibliographySection() {
    const bibliographyBox = byId("bibliography");
    const section = bibliographyBox?.closest("section");
    const heading = section?.querySelector("h3");
    const help = section?.querySelector(".help-text");
    const copy = byId("copyBibliography");
    if (heading) heading.textContent = "References";
    if (help) help.textContent = "Automatically sorted alphabetically. Only sources you selected for citations are included.";
    if (copy) copy.textContent = "Copy references";
  }

  function migrateSources() {
    if (!Array.isArray(state.sources)) return;
    let changed = false;
    state.sources.forEach(source => {
      if (!source.sourceType) { source.sourceType = inferType(source); changed = true; }
      if (!source.accessed && source.url && /^https?:/i.test(source.url)) { source.accessed = todayLong(); changed = true; }
      if (!source.authors && (source.sourceType === "module" || source.sourceType === "module-av")) { source.authors = "The Open University"; changed = true; }
      if (source.year && /^n\.?d\.?$/i.test(source.year)) { source.year = "no date"; changed = true; }
    });
    if (changed) save();
  }

  window.harvardRef = makeHarvardRef;
  window.inlineCitation = makeInlineCitation;
  window.citationName = function citationNamePatched(authors) {
    return citationNameFor({ authors, title: "Untitled source" });
  };
  window.harvardSort = sortKey;

  window.renderCitedDraft = function renderCitedDraftPatched() {
    const text = state.draft || els.draftInput.value || "";
    if (!text) {
      els.citedDraft.value = "";
      els.bibliography.className = "bibliography empty-box";
      els.bibliography.textContent = "No selected citations yet.";
      return;
    }
    const cites = state.citations.filter(c => sourceById(c.sourceId) && c.end <= text.length).sort((a, b) => b.end - a.end);
    const suffixMap = buildSuffixMap(cites);
    let out = text;
    cites.forEach(c => {
      const source = sourceById(c.sourceId);
      out = out.slice(0, c.end) + ` ${makeInlineCitation(source, c.locator, suffixMap.get(source.id) || "")}` + out.slice(c.end);
    });
    els.citedDraft.value = out;
    const refs = [...new Map(cites.map(c => [c.sourceId, sourceById(c.sourceId)])).values()].filter(Boolean).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    if (!refs.length) {
      els.bibliography.className = "bibliography empty-box";
      els.bibliography.textContent = "No selected citations yet.";
      return;
    }
    els.bibliography.className = "bibliography";
    els.bibliography.innerHTML = refs.map(s => `<p>${esc(makeHarvardRef(s, suffixMap.get(s.id) || ""))}</p>`).join("");
  };

  document.addEventListener("DOMContentLoaded", () => {
    ensureReferenceFields();
    captureExtraFields();
    migrateSources();
    renameBibliographySection();
    renderLibrary();
    renderCitedDraft();
  });

  ensureReferenceFields();
  captureExtraFields();
  migrateSources();
  renameBibliographySection();
  renderLibrary();
  renderCitedDraft();
})();
