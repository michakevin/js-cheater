jest.mock("../../src/debug.js", () => ({ DEBUG: true }));
import {
  showError,
  showSuccess,
  showInfo,
  clearStatus,
} from "../../src/popup/messages.js";

describe("messages", () => {
  let statusBar;
  let searchTab;
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="statusBar" class="status-bar hidden"></div>
      <ul id="hits"></ul>
      <div id="searchTab" class="tab-panel active"></div>
    `;
    statusBar = document.getElementById("statusBar");
    searchTab = document.getElementById("searchTab");
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("showError displays message in statusBar with error class", () => {
    showError("Fehler");
    expect(statusBar.textContent).toBe("Fehler");
    expect(statusBar.classList.contains("status-error")).toBe(true);
    expect(statusBar.classList.contains("hidden")).toBe(false);
  });

  test("showError does not overwrite hits list", () => {
    const hits = document.getElementById("hits");
    hits.innerHTML = "<li>existing</li>";
    showError("Fehler");
    expect(hits.innerHTML).toBe("<li>existing</li>");
  });

  test("showSuccess shows message in active search tab", () => {
    showSuccess("Erfolg");
    expect(statusBar.textContent).toBe("Erfolg");
    expect(statusBar.classList.contains("status-success")).toBe(true);
    expect(statusBar.classList.contains("hidden")).toBe(false);
  });

  test("showSuccess shows message even when search tab is inactive", () => {
    searchTab.classList.remove("active");
    showSuccess("Hallo");
    expect(statusBar.textContent).toBe("Hallo");
    expect(statusBar.classList.contains("status-success")).toBe(true);
  });

  test("showInfo displays message with info class", () => {
    showInfo("Loading...");
    expect(statusBar.textContent).toBe("Loading...");
    expect(statusBar.classList.contains("status-info")).toBe(true);
  });

  test("showError auto-hides after 5 seconds", () => {
    showError("Fehler");
    expect(statusBar.classList.contains("hidden")).toBe(false);
    jest.advanceTimersByTime(5000);
    expect(statusBar.classList.contains("hidden")).toBe(true);
  });

  test("showInfo does not auto-hide", () => {
    showInfo("Loading...");
    expect(statusBar.classList.contains("hidden")).toBe(false);
    jest.advanceTimersByTime(10000);
    expect(statusBar.classList.contains("hidden")).toBe(false);
  });

  test("clearStatus hides and resets statusBar", () => {
    showError("Fehler");
    clearStatus();
    expect(statusBar.classList.contains("hidden")).toBe(true);
    expect(statusBar.textContent).toBe("");
    expect(statusBar.classList.contains("status-error")).toBe(false);
  });
});
