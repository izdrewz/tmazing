(() => {
  if (window.__tmazingFeedbackExportReminderLoaded) return;
  window.__tmazingFeedbackExportReminderLoaded = true;

  const STORAGE_KEY = "tmazing-feedback-markup-library-v1";

  function esc(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function readLibrary() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        repoPath: "feedback-markup/library/feedback-index.json",
        records: Array.isArray(parsed.records) ? parsed.records : [],
        dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : []
      };
    } catch {
      return { version: 1, exportedAt: new Date().toISOString(), repoPath: "feedback-markup/library/feedback-index.json", records: [], dismissed: [] };
    }
  }

  function downloadExport() {
    const data = readLibrary();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedback-index.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyJson() {
    const text = JSON.stringify(readLibrary(), null, 2);
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

  function ensureReminder() {
    const panel = document.getElementById("feedbackMarkup");
    if (!panel || document.getElementById("feedbackRepoReminder")) return;
    const tabs = panel.querySelector(".feedback-tabs");
    const reminder = document.createElement("div");
    reminder.id = "feedbackRepoReminder";
    reminder.className = "feedback-repo-reminder";
    reminder.innerHTML = `
      <strong>Repo save reminder</strong>
      <span>The dashboard saves feedback in this browser first. Export <code>feedback-index.json</code> after changes, then save it to <code>feedback-markup/library/feedback-index.json</code> so it remains in the private repo.</span>
      <button id="feedbackDownloadIndex" type="button">Download feedback-index.json</button>
      <button id="feedbackCopyIndex" class="ghost" type="button">Copy JSON</button>`;
    if (tabs) tabs.insertAdjacentElement("afterend", reminder);
    else panel.prepend(reminder);
    document.getElementById("feedbackDownloadIndex")?.addEventListener("click", downloadExport);
    document.getElementById("feedbackCopyIndex")?.addEventListener("click", () => {
      copyJson();
      flash("JSON copied. Paste it into feedback-markup/library/feedback-index.json in the private repo.");
    });
  }

  function flash(message) {
    const box = document.getElementById("feedbackRepoReminder");
    if (!box) return;
    let status = document.getElementById("feedbackRepoReminderStatus");
    if (!status) {
      status = document.createElement("p");
      status.id = "feedbackRepoReminderStatus";
      status.className = "feedback-help";
      box.appendChild(status);
    }
    status.textContent = message;
  }

  function promptExport(message) {
    ensureReminder();
    flash(message || "Feedback saved locally. Export now if you want the private repo copy updated.");
    setTimeout(() => {
      if (confirm("Feedback saved locally. Download feedback-index.json now so you can save it to feedback-markup/library/feedback-index.json?")) downloadExport();
    }, 120);
  }

  function bind() {
    ensureReminder();
    const form = document.getElementById("feedbackImportForm");
    if (form && !form.dataset.exportReminderBound) {
      form.dataset.exportReminderBound = "true";
      form.addEventListener("submit", () => {
        setTimeout(() => promptExport("Saved locally. Export feedback-index.json to keep the private repo library current."), 250);
      });
    }

    const importInput = document.getElementById("feedbackImportLibrary");
    if (importInput && !importInput.dataset.exportReminderBound) {
      importInput.dataset.exportReminderBound = "true";
      importInput.addEventListener("change", () => {
        setTimeout(() => promptExport("Imported locally. Export feedback-index.json again if you want the private repo copy to match this browser."), 350);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", bind);
  const timer = setInterval(() => {
    bind();
    if (document.getElementById("feedbackMarkup")) clearInterval(timer);
  }, 300);
})();
