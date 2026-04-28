(() => {
  const HUB_KEYS = ["tmazing-uni-hub-v2", "tmazing-uni-hub-v1"];
  function readHub() {
    for (const key of HUB_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
    return { deadlines: [], goals: [], sources: [] };
  }
  function esc(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  }
  function moduleCodes(hub) {
    const codes = new Set();
    (hub.sources || []).forEach(s => s.module && codes.add(s.module.toUpperCase()));
    (hub.deadlines || []).forEach(d => d.module && codes.add(d.module.toUpperCase()));
    return [...codes].sort();
  }
  function inject() {
    if (document.getElementById("moduleDashboards")) return;
    const section = document.createElement("section");
    section.id = "moduleDashboards";
    section.className = "panel wide-panel module-dashboard-panel";
    section.innerHTML = `
      <div class="section-head">
        <div><p class="eyebrow">Modules</p><h2>Module dashboards</h2></div>
        <button id="refreshModules" class="ghost" type="button">Refresh modules</button>
      </div>
      <div id="moduleDashboardGrid" class="module-grid empty-box">Add sources or deadlines with module codes like E104 or K102.</div>`;
    const main = document.querySelector("main.app-shell");
    const library = document.getElementById("library");
    main?.insertBefore(section, library);
    document.getElementById("refreshModules").onclick = render;
    render();
  }
  function render() {
    const grid = document.getElementById("moduleDashboardGrid");
    if (!grid) return;
    const hub = readHub();
    const codes = moduleCodes(hub);
    if (!codes.length) {
      grid.className = "module-grid empty-box";
      grid.textContent = "Add sources or deadlines with module codes like E104 or K102.";
      return;
    }
    grid.className = "module-grid";
    grid.innerHTML = codes.map(code => cardFor(code, hub)).join("");
    grid.querySelectorAll("[data-filter-module]").forEach(button => {
      button.addEventListener("click", () => {
        const filter = document.getElementById("moduleFilter");
        const search = document.getElementById("librarySearch");
        if (filter) {
          const option = [...filter.options].find(o => o.value === button.dataset.filterModule);
          if (option) filter.value = button.dataset.filterModule;
          filter.dispatchEvent(new Event("change"));
        }
        if (search) search.value = "";
        document.getElementById("library")?.scrollIntoView({ behavior: "smooth" });
      });
    });
  }
  function cardFor(code, hub) {
    const sources = (hub.sources || []).filter(s => String(s.module || "").toUpperCase() === code);
    const deadlines = (hub.deadlines || []).filter(d => String(d.module || "").toUpperCase() === code && !d.done);
    const goals = (hub.goals || []).filter(g => new RegExp(code, "i").test(`${g.title || ""} ${g.notes || ""}`));
    const units = [...new Set(sources.map(s => s.unit).filter(Boolean))].sort();
    const nextDeadline = deadlines.slice().sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))[0];
    const due = nextDeadline ? daysUntil(nextDeadline.date) : null;
    const deadlineLine = nextDeadline ? `${esc(nextDeadline.title || "Deadline")} — ${esc(nextDeadline.date || "no date")}${due !== null ? ` (${due} day(s))` : ""}` : "No active dated deadline";
    return `<article class="module-card">
      <div class="module-card-head"><h3>${esc(code)}</h3><span>${sources.length} source(s)</span></div>
      <p class="help-text"><strong>Next:</strong> ${deadlineLine}</p>
      <p class="help-text"><strong>Units/blocks:</strong> ${esc(units.join(", ") || "None yet")}</p>
      <p class="help-text"><strong>Goals mentioning module:</strong> ${goals.length}</p>
      <div class="actions-row"><button type="button" data-filter-module="${esc(code)}">Filter library</button><a class="file-button ghost" href="#checker">Check draft</a></div>
    </article>`;
  }
  inject();
  new MutationObserver(() => { if (!document.getElementById("moduleDashboards")) inject(); }).observe(document.body, { childList: true, subtree: true });
})();
