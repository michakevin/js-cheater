/* global describe, test, expect, beforeEach */
import { showError, showSuccess } from "../../src/popup/messages.js";

describe("messages", () => {
  let hits;
  let searchTab;
  beforeEach(() => {
    document.body.innerHTML = `
      <ul id="hits"></ul>
      <div id="searchTab" class="tab-panel active"></div>
    `;
    hits = document.getElementById("hits");
    searchTab = document.getElementById("searchTab");
  });

  test("showError adds red list item", () => {
    showError("Fehler");
    const li = hits.querySelector("li");
    expect(li.textContent).toBe("Fehler");
    expect(li.style.color).toBe("rgb(231, 76, 60)");
  });

  test("showSuccess shows message in active search tab", () => {
    showSuccess("Erfolg");
    const li = hits.querySelector("li");
    expect(li.textContent).toBe("Erfolg");
    expect(li.style.color).toBe("rgb(39, 174, 96)");
  });

  test("showSuccess logs message when search tab inactive", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    searchTab.classList.remove("active");
    showSuccess("Hallo");
    expect(logSpy).toHaveBeenCalledWith("✅", "Hallo");
    logSpy.mockRestore();
  });
});
