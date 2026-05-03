(() => {
  if (window.__tmazingSourceUrlExtractorLoaded) return;
  window.__tmazingSourceUrlExtractorLoaded = true;

  const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()"']+/gi;
  const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
  const REF_HEADING_RE = /^(references|reference list|bibliography|further reading|sources|external links|links|resources|feedback|answer|conclusion)$/i;

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

  function resetRegexes() {
    URL_RE.lastIndex = 0;
    DOI_RE.lastIndex = 0;
  }

  function stripUrls(line) {
    resetRegexes();
    return clean(String(line || "").replace(URL_RE, " ").replace(DOI_RE, " "));
  }

  function isRealHeading(line) {
    const text = clean(stripUrls(line));
    if (!text) return false;
    if (text.length > 135) return false;
    if (REF_HEADING_RE.test(text)) return true;
    if (/^Topic\s+\d+\s*:/i.test(text)) return true;
    if (/^\d+(?:\.\d+)*\s+\S/.test(text)) return true;
    if (/^Activity\s+\d+(?:\.\d+)*\b/i.test(text)) return true;
    if (/^Block\s+\d+\s+Skills\s+activity\s+\d+/i.test(text)) return true;
    if (/^Transcript\s*:/i.test(text)) return true;
    if (/^End of transcript\s*:/i.test(text)) return true;
    if (/^[A-Z]\.?\s+The\s+social\s+science\s+critique/i.test(text)) return true;
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

  function sectionMap(lines) {
    const map = [];
    let current = "";
    let parent = "";
    let lastNumbered = "";
    lines.forEach((line, index) => {
      const text = clean(stripUrls(line.text));
      if (isRealHeading(text)) {
        if (/^Topic\s+\d+\s*:/i.test(text)) {
          parent = text;
          current = text;
        } else if (/^\d+(?:\.\d+)*\s+\S/.test(text) || /^Activity\s+\d+(?:\.\d+)*\b/i.test(text) || /^Block\s+\d+\s+Skills\s+activity\s+\d+/i.test(text)) {
          lastNumbered = text;
          current = text;
        } else if (/^[A-Z]\.?\s+The\s+social\s+science\s+critique/i.test(text)) {
          current = text;
        } else if (REF_HEADING_RE.test(text) || /^Transcript\s*:/i.test(text) || /^End of transcript\s*:/i.test(text)) {
          current = text;
        }
      }
      map[index] = { current: current || parent || lastNumbered || "Document", parent: parent || "", lastNumbered: lastNumbered || "" };
    });
    return map;
  }

  function inlineTitleBeforeUrl(lineText, rawUrl) {
    const raw = String(lineText || "").trim();
    const index = raw.indexOf(rawUrl);
    if (index <= 0) return "";
    let before = raw.slice(0, index).trim();
    before = before.replace(/\($/, "").trim();
    before = before.replace(/^(see|go to|follow|visit|available at|source|from)\s+/i, "").trim();
    before = before.replace(/[,:;\-–—\s]+$/g, "").trim();
    if (!before || before.length < 4) return "";

    const openParen = before.lastIndexOf("(");
    if (openParen > -1 && before.length - openParen < 80) {
      const inside = before.slice(openParen + 1).trim();
      const beforeParen = before.slice(0, openParen).trim();
      const sourceLabel = inside.split(/:/)[0].trim();
      if (sourceLabel && sourceLabel.length < 70) return sourceLabel;
      if (beforeParen) return beforeParen;
    }
    return before.slice(0, 180);
  }

  function inlineReferenceTitle(lineText, rawUrl) {
    const raw = String(lineText || "").trim();
    const index = raw.indexOf(rawUrl);
    if (index <= 0) return "";
    const before = raw.slice(0, index).trim();
    const openParen = before.lastIndexOf("(");
    if (openParen > -1) {
      const content = before.slice(openParen + 1).trim();
      const label = content.split(/:/)[0].trim();
      if (label && label.length < 90) return label;
    }
    return inlineTitleBeforeUrl(lineText, rawUrl);
  }

  function cleanReferenceTextForTitle(value) {
    return clean(value)
      .replace(/\s*\([^)]*(?:https?:\/\/|www\.)[^)]*\)/gi, "")
      .replace(/\s*\([^)]*\b10\.\d{4,9}\/[^")]+\)/gi, "")
      .replace(/[,:;\-–—\s]+$/g, "")
      .slice(0, 210)
      .trim();
  }

  function headingFor(lines, sectionInfo, index, fallback) {
    const sameLine = inlineTitleBeforeUrl(lines[index]?.text || "", (lines[index]?.text.match(URL_RE) || [""])[0]);
    if (sameLine && sameLine.length < 140 && !/^https?:/i.test(sameLine)) return sameLine;
    return sectionInfo?.current || fallback || "Source link";
  }

  function displayTitleForLink(lineText, rawUrl, sectionInfo) {
    const sameLine = inlineReferenceTitle(lineText, rawUrl);
    if (sameLine) return cleanReferenceTextForTitle(sameLine);
    return sectionInfo?.current || "Source link";
  }

  function locationFor(source, sectionInfo, line) {
    const page = line.text.match(/^\[Page \d+\]/)?.[0]?.replace(/[\[\]]/g, "");
    return page || sectionInfo?.current || source.unit || "Document text";
  }

  function nearbyReference(lines, index) {
    const start = Math.max(0, index - 1);
    const end = Math.min(lines.length - 1, index + 1);
    const chunk = lines.slice(start, end + 1).map(line => line.text).filter(Boolean).join(" ");
    return clean(chunk).slice(0, 850);
  }

  function extractFromSource(source) {
    const text = String(source.text || "");
    const lines = lineSource(text);
    const sections = sectionMap(lines);
    const found = [];
    const seen = new Set();

    lines.forEach((line, index) => {
      const sectionInfo = sections[index] || {};
      const lineText = line.text || "";

      for (const match of lineText.matchAll(URL_RE)) {
        const rawUrl = match[0];
        const url = normaliseUrl(rawUrl);
        if (!url || seen.has(url.toLowerCase())) continue;
        seen.add(url.toLowerCase());
        const subheading = sectionInfo.current || source.unit || source.title || "Source link";
        const title = displayTitleForLink(lineText, rawUrl, sectionInfo);
        found.push({
          type: "url",
          url,
          title: title || subheading,
          subheading,
          group: subheading,
          parentHeading: sectionInfo.parent || "",
          note: nearbyReference(lines, index),
          location: locationFor(source, sectionInfo, line),
        });
      }

      for (const match of lineText.matchAll(DOI_RE)) {
        const doi = match[0].replace(/[),.;:]+$/g, "");
        const url = `https://doi.org/${doi}`;
        if (seen.has(url.toLowerCase())) continue;
        seen.add(url.toLowerCase());
        const subheading = sectionInfo.current || source.unit || source.title || "Source link";
        const title = displayTitleForLink(lineText, doi, sectionInfo);
        found.push({
          type: "doi",
          url,
          title: title || subheading,
          subheading,
          group: subheading,
          parentHeading: sectionInfo.parent || "",
          note: nearbyReference(lines, index),
          location: locationFor(source, sectionInfo, line),
        });
      }
    });

    return found;
  }

  function titleFromExternal(link) {
    const title = cleanReferenceTextForTitle(link.title || "");
    if (title) return title;
    const note = clean(link.note).replace(link.url, "").replace(/Available at:.*$/i, "").replace(/Retrieved from.*$/i, "").trim();
    const yearMatch = note.match(/\((\d{4}|no date|n\.?d\.?)\)/i);
    if (yearMatch) {
      const after = note.slice(yearMatch.index + yearMatch[0].length).replace(/^[.\s:,-]+/, "").trim();
      if (after) return after.split(/[.。]/)[0].slice(0, 160).trim() || link.subheading;
    }
    return link.subheading || "External source";
  }

  function authorsFromExternal(link) {
    const note = clean(link.note);
    const sourceLabel = inlineReferenceTitle(note, link.url);
    if (sourceLabel && sourceLabel.length < 90 && !sourceLabel.includes(" ".repeat(2))) return sourceLabel;
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

  function findExistingExternal(parent, link) {
    return state.sources.find(s => s.parentSourceId === parent.id && normaliseUrl(s.url || "").toLowerCase() === normaliseUrl(link.url || "").toLowerCase());
  }

  function addExternalSourceByUrl(sourceId, url) {
    const parent = state.sources.find(source => source.id === sourceId);
    if (!parent) return;
    const link = extractFromSource(parent).find(item => normaliseUrl(item.url).toLowerCase() === normaliseUrl(url).toLowerCase());
    if (!link) return;
    const existing = findExistingExternal(parent, link);
    if (existing) {
      existing.parentSubheading = link.subheading || existing.parentSubheading || parent.unit || "Further sources";
      existing.unit = existing.parentSubheading;
      save();
      renderLibrary();
      return;
    }
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
      fileType: "sub-source from main source",
      sourceType: "webpage",
      accessed: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      parentSourceId: parent.id,
      parentSubheading: link.subheading || parent.unit || "Further sources",
      created: new Date().toISOString()
    });
    save();
    renderModuleFilter();
    renderLibrary();
    if (typeof analyseDraft === "function") analyseDraft(false);
    if (typeof renderCitedDraft === "function") renderCitedDraft();
  }

  function groupLinks(links) {
    const groups = new Map();
    links.forEach(link => {
      const group = link.group || link.subheading || "Further sources";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(link);
    });
    return [...groups.entries()];
  }

  function renderLinksForCard(card, source) {
    if (!card || card.querySelector(".found-source-links")) return;
    const links = extractFromSource(source);
    if (!links.length) return;
    const existingUrls = new Set(state.sources.filter(s => s.parentSourceId === source.id).map(s => normaliseUrl(s.url || "").toLowerCase()));
    const box = document.createElement("details");
    box.className = "found-source-links";
    box.innerHTML = `<summary>Found URLs / further sources (${links.length})</summary><div class="found-link-groups">${groupLinks(links).map(([group, groupLinks]) => `<section class="found-link-group">
      <h4>${esc(group)}</h4>
      <div class="found-link-list">${groupLinks.map(link => {
        const added = existingUrls.has(normaliseUrl(link.url).toLowerCase());
        return `<article class="found-link-card">
          <p class="found-link-title">${esc(link.title || link.subheading || "Source link")}</p>
          <p class="source-meta">Sub source of: ${esc(source.title)} • ${esc(link.location || "Document text")}</p>
          <a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.url)}</a>
          ${link.note ? `<p class="found-link-note">${esc(link.note)}</p>` : ""}
          <button type="button" class="ghost" data-external-source="${source.id}" data-external-url="${esc(link.url)}">${added ? "Already added" : "Add this as a sub-source"}</button>
        </article>`;
      }).join("")}</div>
    </section>`).join("")}</div>`;
    const actions = card.querySelector(".source-actions");
    if (actions) actions.insertAdjacentElement("beforebegin", box);
    else card.appendChild(box);
    box.querySelectorAll("[data-external-source]").forEach(button => {
      button.addEventListener("click", () => addExternalSourceByUrl(button.dataset.externalSource, button.dataset.externalUrl));
    });
  }

  function sourceLabel(source) {
    return `${source.title || ""}|${source.module || ""}|${source.unit || ""}|${source.authors || ""}|${source.year || ""}`;
  }

  function findSourceForCard(card, used = new Set()) {
    const title = card.querySelector("h3")?.textContent?.trim() || "";
    const meta = card.querySelector(".source-meta")?.textContent || "";
    const matches = state.sources.filter(s => !used.has(s.id) && s.title === title && (!s.module || meta.includes(s.module)) && (!s.unit || meta.includes(s.unit)));
    return matches[0] || null;
  }

  function renderSubSourcesForCard(card, parent) {
    if (!card || card.querySelector(".parent-sub-sources")) return;
    const children = state.sources.filter(s => s.parentSourceId === parent.id);
    if (!children.length) return;
    const groups = new Map();
    children.forEach(child => {
      const group = child.parentSubheading || child.unit || "Further sources";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(child);
    });
    const details = document.createElement("details");
    details.className = "parent-sub-sources";
    details.open = true;
    details.innerHTML = `<summary>Sub-sources added from this source (${children.length})</summary><div class="sub-source-groups">${[...groups.entries()].map(([group, items]) => `<section class="sub-source-group"><h4>${esc(group)}</h4>${items.map(child => `<article class="sub-source-card">
      <p class="found-link-title">${esc(child.title)}</p>
      <p class="source-meta">${esc(child.authors)} (${esc(child.year)}) • ${esc(child.publisher || "")}</p>
      <a href="${esc(child.url)}" target="_blank" rel="noopener noreferrer">${esc(child.url)}</a>
      <div class="source-actions"><button type="button" class="ghost" data-copy-sub-source="${child.id}">Copy ref</button><button type="button" class="danger" data-remove-sub-source="${child.id}">Remove sub-source</button></div>
    </article>`).join("")}</section>`).join("")}</div>`;
    const actions = card.querySelector(".source-actions");
    if (actions) actions.insertAdjacentElement("beforebegin", details);
    else card.appendChild(details);
    details.querySelectorAll("[data-copy-sub-source]").forEach(button => {
      button.addEventListener("click", () => {
        const child = state.sources.find(s => s.id === button.dataset.copySubSource);
        if (child) copyText(harvardRef(child));
      });
    });
    details.querySelectorAll("[data-remove-sub-source]").forEach(button => {
      button.addEventListener("click", () => {
        if (!confirm("Remove this sub-source?")) return;
        state.sources = state.sources.filter(s => s.id !== button.dataset.removeSubSource);
        state.citations = state.citations.filter(c => c.sourceId !== button.dataset.removeSubSource);
        save();
        renderModuleFilter();
        renderLibrary();
        if (typeof analyseDraft === "function") analyseDraft(false);
        if (typeof renderCitedDraft === "function") renderCitedDraft();
      });
    });
  }

  function enhanceLibrary() {
    const cards = [...document.querySelectorAll(".source-library .source-card")];
    const used = new Set();
    const q = clean(document.getElementById("librarySearch")?.value || "");
    cards.forEach(card => {
      const source = findSourceForCard(card, used);
      if (!source) return;
      used.add(source.id);
      card.dataset.sourceId = source.id;
      if (source.parentSourceId && !q) {
        card.classList.add("sub-source-hidden-top-level");
        card.hidden = true;
        return;
      }
      if (source.parentSourceId && q) {
        card.classList.add("sub-source-search-result");
        const parent = state.sources.find(s => s.id === source.parentSourceId);
        if (parent && !card.querySelector(".sub-source-parent-note")) {
          card.insertAdjacentHTML("afterbegin", `<p class="sub-source-parent-note">Sub-source of: ${esc(parent.title)}</p>`);
        }
      }
      if (!source.parentSourceId) {
        renderLinksForCard(card, source);
        renderSubSourcesForCard(card, source);
      }
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
      if (source.parentSourceId && !source.parentSubheading) {
        source.parentSubheading = source.unit || "Further sources";
        changed = true;
      }
      if (source.parentSourceId && source.fileType === "extracted external source") {
        source.fileType = "sub-source from main source";
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
