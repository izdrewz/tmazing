(() => {
  if (window.__tmazingSourceUrlExtractorLoaded) return;
  window.__tmazingSourceUrlExtractorLoaded = true;

  const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()"']+/gi;
  const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
  const REF_HEADING_RE = /^(references|reference list|bibliography|further reading|sources|external links|links|resources)$/i;

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

  function isHeading(line) {
    const text = clean(line);
    if (!text || URL_RE.test(text)) return false;
    URL_RE.lastIndex = 0;
    if (text.length > 95) return false;
    if (REF_HEADING_RE.test(text)) return true;
    if (/^(block|unit|chapter|section|topic|activity|part)\s+\d+/i.test(text)) return true;
    if (/^[A-Z][A-Za-z0-9,:'’()\-/& ]{2,90}$/.test(text) && !/[.!?]$/.test(text)) return true;
    return false;
  }

  function lineSource(text) {
    const rawLines = String(text || "").split(/\n+/);
    const lines = [];
    let offset = 0;
    rawLines.forEach(raw => {
      const line = raw.trim();
      const start = String(text || "").indexOf(raw, offset);
      lines.push({ text: line, start: start >= 0 ? start : offset, end: (start >= 0 ? start : offset) + raw.length });
      offset = (start >= 0 ? start : offset) + raw.length + 1;
    });
    return lines;
  }

  function headingFor(lines, index, fallback) {
    for (let i = index; i >= Math.max(0, index - 8); i--) {
      if (isHeading(lines[i]?.text)) return clean(lines[i].text);
    }
    return fallback || "Source link";
  }

  function nearbyReference(lines, index) {
    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length - 1, index + 2);
    const chunk = lines.slice(start, end + 1).map(line => line.text).filter(Boolean).join(" ");
    return clean(chunk).slice(0, 650);
  }

  function extractFromSource(source) {
    const text = String(source.text || "");
    const lines = lineSource(text);
    const found = [];
    const seen = new Set();

    lines.forEach((line, index) => {
      for (const match of line.text.matchAll(URL_RE)) {
        const url = normaliseUrl(match[0]);
        if (!url || seen.has(url.toLowerCase())) continue;
        seen.add(url.toLowerCase());
        found.push({
          type: "url",
          url,
          subheading: headingFor(lines, index, source.unit || source.title),
          note: nearbyReference(lines, index),
          location: line.text.match(/^\[Page \d+\]/)?.[0]?.replace(/[\[\]]/g, "") || source.unit || "Document text",
        });
      }
      for (const match of line.text.matchAll(DOI_RE)) {
        const doi = match[0].replace(/[),.;:]+$/g, "");
        const url = `https://doi.org/${doi}`;
        if (seen.has(url.toLowerCase())) continue;
        seen.add(url.toLowerCase());
        found.push({
          type: "doi",
          url,
          subheading: headingFor(lines, index, source.unit || source.title),
          note: nearbyReference(lines, index),
          location: line.text.match(/^\[Page \d+\]/)?.[0]?.replace(/[\[\]]/g, "") || source.unit || "Document text",
        });
      }
    });

    return found;
  }

  function titleFromExternal(link) {
    const note = clean(link.note).replace(link.url, "").replace(/Available at:.*$/i, "").replace(/Retrieved from.*$/i, "").trim();
    const yearMatch = note.match(/\((\d{4}|no date|n\.?d\.?)\)/i);
    if (yearMatch) {
      const after = note.slice(yearMatch.index + yearMatch[0].length).replace(/^[.\s:,-]+/, "").trim();
      if (after) return after.split(/[.。]/)[0].slice(0, 120).trim() || link.subheading;
    }
    return link.subheading || "External source";
  }

  function authorsFromExternal(link) {
    const note = clean(link.note);
    const yearIndex = note.search(/\((\d{4}|no date|n\.?d\.?)\)/i);
    if (yearIndex > 0) return note.slice(0, yearIndex).replace(/[.\s]+$/g, "").trim();
    try {
      return new URL(link.url).hostname.replace(/^www\./, "");
    } catch {
      return "External source";
    }
  }

  function yearFromExternal(link) {
    const m = clean(link.note).match(/\((\d{4}|no date|n\.?d\.?)\)/i);
    return m ? m[1].replace(/^n\.?d\.?$/i, "no date") : "no date";
  }

  function publisherFromUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return "External website"; }
  }

  function addExternalSource(sourceId, index) {
    const parent = state.sources.find(source => source.id === sourceId);
    if (!parent) return;
    const link = extractFromSource(parent)[index];
    if (!link) return;
    state.sources.push({
      id: id(),
      module: parent.module || "",
      unit: link.subheading || parent.unit || "External source",
      title: titleFromExternal(link),
      authors: authorsFromExternal(link),
      year: yearFromExternal(link),
      publisher: publisherFromUrl(link.url),
      url: link.url,
      pages: link.location,
      text: link.note || link.url,
      segments: [{ id: id(), location: link.location || "Extracted link", citationLocator: link.location || "extracted link", text: link.note || link.url }],
      fileName: "",
      fileType: "extracted external source",
      sourceType: "webpage",
      accessed: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      parentSourceId: parent.id,
      created: new Date().toISOString()
    });
    save();
    renderModuleFilter();
    renderLibrary();
    analyseDraft(false);
    renderCitedDraft();
  }

  function renderLinksForCard(card, source) {
    if (!card || card.querySelector(".found-source-links")) return;
    const links = extractFromSource(source);
    if (!links.length) return;
    const box = document.createElement("details");
    box.className = "found-source-links";
    box.innerHTML = `<summary>Found URLs / further sources (${links.length})</summary><div class="found-link-list">${links.map((link, index) => `<article class="found-link-card">
      <h4>${esc(link.subheading || "Source link")}</h4>
      <p class="source-meta">${esc(link.location || "Document text")}</p>
      <a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.url)}</a>
      ${link.note ? `<p class="found-link-note">${esc(link.note)}</p>` : ""}
      <button type="button" class="ghost" data-external-source="${source.id}" data-external-index="${index}">Add this as a source</button>
    </article>`).join("")}</div>`;
    const actions = card.querySelector(".source-actions");
    if (actions) actions.insertAdjacentElement("beforebegin", box);
    else card.appendChild(box);
    box.querySelectorAll("[data-external-source]").forEach(button => {
      button.addEventListener("click", () => addExternalSource(button.dataset.externalSource, Number(button.dataset.externalIndex)));
    });
  }

  function enhanceLibrary() {
    const cards = [...document.querySelectorAll(".source-library .source-card")];
    cards.forEach(card => {
      const title = card.querySelector("h3")?.textContent?.trim();
      const meta = card.querySelector(".source-meta")?.textContent || "";
      const source = state.sources.find(s => s.title === title && meta.includes(s.module || ""));
      if (source) renderLinksForCard(card, source);
    });
  }

  function patchRenderLibrary() {
    if (window.__tmazingUrlRenderPatch) return;
    window.__tmazingUrlRenderPatch = true;
    const original = renderLibrary;
    renderLibrary = function patchedRenderLibrary(...args) {
      const result = original.apply(this, args);
      requestAnimationFrame(enhanceLibrary);
      return result;
    };
  }

  function patchAddSource() {
    if (window.__tmazingUrlAddSourcePatch) return;
    window.__tmazingUrlAddSourcePatch = true;
    const original = addSource;
    addSource = function patchedAddSource(event) {
      const result = original.apply(this, arguments);
      const latest = state.sources[state.sources.length - 1];
      if (latest) latest.extractedLinks = extractFromSource(latest);
      save();
      setTimeout(() => { renderLibrary(); }, 0);
      return result;
    };
  }

  function migrate() {
    let changed = false;
    state.sources.forEach(source => {
      const links = extractFromSource(source);
      if (links.length && JSON.stringify(source.extractedLinks || []) !== JSON.stringify(links)) {
        source.extractedLinks = links;
        changed = true;
      }
    });
    if (changed) save();
  }

  document.addEventListener("DOMContentLoaded", () => {
    patchRenderLibrary();
    patchAddSource();
    migrate();
    enhanceLibrary();
  });

  patchRenderLibrary();
  patchAddSource();
  migrate();
  setTimeout(enhanceLibrary, 0);
})();
