import { jest } from "@jest/globals";
import {
  compressToBase64,
  decompressFromBase64,
} from "../../src/popup/lz-string.js";

async function settleAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe("save-editor behavior regressions", () => {
  afterEach(() => {
    delete globalThis.chrome;
    jest.resetModules();
  });

  test("save error keeps pending changes and slot deselection resets state", async () => {
    const slotRaw = compressToBase64(JSON.stringify({ gold: 100 }));
    const sentCommands = [];

    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, callback) => {
          sentCommands.push(message);
          if (message.cmd === "getRpgMakerSaves") {
            callback({
              slots: [
                { key: "RPG File1", source: "localStorage", raw: slotRaw },
              ],
            });
            return;
          }
          if (message.cmd === "setRpgMakerSave") {
            callback({ error: "write failed" });
            return;
          }
          callback(null);
        }),
      },
      runtime: {},
    };

    document.body.innerHTML = `
      <div class="editor-toolbar">
        <select id="slotSelect"><option value="">--</option></select>
        <button id="refreshSlots" type="button">refresh</button>
        <button id="saveChanges" type="button" disabled>save</button>
        <button id="expandAll" type="button">expand</button>
        <button id="collapseAll" type="button">collapse</button>
      </div>
      <div id="searchBar" class="hidden">
        <input id="searchInput" />
        <span id="searchCount"></span>
      </div>
      <div id="statusMessage" class="hidden"></div>
      <div id="editorContent"></div>
    `;
    window.history.replaceState(
      {},
      "",
      "http://localhost/src/popup/save-editor.html?tabId=1",
    );

    await import("../../src/popup/save-editor.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settleAsyncWork();

    const slotSelect = document.getElementById("slotSelect");
    slotSelect.value = "RPG File1";
    slotSelect.dispatchEvent(new Event("change"));
    await settleAsyncWork();

    const valueEl = document.querySelector(".json-value");
    expect(valueEl).not.toBeNull();
    valueEl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const editInput = document.querySelector(".json-edit-input");
    expect(editInput).not.toBeNull();
    editInput.value = "150";
    editInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    const saveButton = document.getElementById("saveChanges");
    expect(saveButton.disabled).toBe(false);

    saveButton.click();
    await settleAsyncWork();

    const statusMessage = document.getElementById("statusMessage");
    expect(statusMessage.textContent).toContain("Fehler beim Speichern");
    expect(statusMessage.textContent).toContain("write failed");
    expect(saveButton.disabled).toBe(false);
    expect(
      sentCommands.filter((message) => message.cmd === "setRpgMakerSave"),
    ).toHaveLength(1);

    slotSelect.value = "";
    slotSelect.dispatchEvent(new Event("change"));
    await settleAsyncWork();

    expect(saveButton.disabled).toBe(true);

    saveButton.click();
    await settleAsyncWork();
    expect(
      sentCommands.filter((message) => message.cmd === "setRpgMakerSave"),
    ).toHaveLength(1);
  });

  test("editing a nested value writes the correct nested path on save", async () => {
    const slotRaw = compressToBase64(
      JSON.stringify({ party: { gold: 100, name: "Hero" } }),
    );
    const sentCommands = [];

    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, callback) => {
          sentCommands.push(message);
          if (message.cmd === "getRpgMakerSaves") {
            callback({
              slots: [
                { key: "RPG File1", source: "localStorage", raw: slotRaw },
              ],
            });
            return;
          }
          if (message.cmd === "setRpgMakerSave") {
            callback({ success: true });
            return;
          }
          callback(null);
        }),
      },
      runtime: {},
    };

    document.body.innerHTML = `
      <div class="editor-toolbar">
        <select id="slotSelect"><option value="">--</option></select>
        <button id="refreshSlots" type="button">refresh</button>
        <button id="saveChanges" type="button" disabled>save</button>
        <button id="expandAll" type="button">expand</button>
        <button id="collapseAll" type="button">collapse</button>
      </div>
      <div id="searchBar" class="hidden">
        <input id="searchInput" />
        <span id="searchCount"></span>
      </div>
      <div id="statusMessage" class="hidden"></div>
      <div id="editorContent"></div>
    `;
    window.history.replaceState(
      {},
      "",
      "http://localhost/src/popup/save-editor.html?tabId=1",
    );

    await import("../../src/popup/save-editor.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settleAsyncWork();

    const slotSelect = document.getElementById("slotSelect");
    slotSelect.value = "RPG File1";
    slotSelect.dispatchEvent(new Event("change"));
    await settleAsyncWork();

    // Expand the "party" category so its children render
    const catHeader = document.querySelector(".category-header");
    expect(catHeader).not.toBeNull();
    // already expanded by default; find nested gold value
    const goldNode = Array.from(document.querySelectorAll(".json-node")).find(
      (n) => n.textContent.includes("gold"),
    );
    expect(goldNode).not.toBeNull();
    const valueEl = goldNode.querySelector(".json-value");
    valueEl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const editInput = document.querySelector(".json-edit-input");
    expect(editInput).not.toBeNull();
    editInput.value = "500";
    editInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    const saveButton = document.getElementById("saveChanges");
    saveButton.click();
    await settleAsyncWork();

    const writes = sentCommands.filter((m) => m.cmd === "setRpgMakerSave");
    expect(writes).toHaveLength(1);
    const parsed = JSON.parse(decompressFromBase64(writes[0].raw));
    expect(parsed).toEqual({ party: { gold: 500, name: "Hero" } });
  });

  test("search hides non-matching rows and reveals the path to matches", async () => {
    const slotRaw = compressToBase64(
      JSON.stringify({ party: { gold: 100, name: "Hero" } }),
    );

    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, callback) => {
          if (message.cmd === "getRpgMakerSaves") {
            callback({
              slots: [
                { key: "RPG File1", source: "localStorage", raw: slotRaw },
              ],
            });
            return;
          }
          callback(null);
        }),
      },
      runtime: {},
    };

    document.body.innerHTML = `
      <div class="editor-toolbar">
        <select id="slotSelect"><option value="">--</option></select>
        <button id="refreshSlots" type="button">refresh</button>
        <button id="saveChanges" type="button" disabled>save</button>
        <button id="expandAll" type="button">expand</button>
        <button id="collapseAll" type="button">collapse</button>
      </div>
      <div id="searchBar" class="hidden">
        <input id="searchInput" />
        <span id="searchCount"></span>
      </div>
      <div id="statusMessage" class="hidden"></div>
      <div id="editorContent"></div>
    `;
    window.history.replaceState(
      {},
      "",
      "http://localhost/src/popup/save-editor.html?tabId=1",
    );

    await import("../../src/popup/save-editor.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settleAsyncWork();

    const slotSelect = document.getElementById("slotSelect");
    slotSelect.value = "RPG File1";
    slotSelect.dispatchEvent(new Event("change"));
    await settleAsyncWork();

    const findRow = (text) =>
      Array.from(document.querySelectorAll(".json-key-row")).find((r) =>
        r.querySelector(".json-key")?.textContent === text,
      );

    const input = document.getElementById("searchInput");
    input.value = "name";
    input.dispatchEvent(new Event("input"));
    // performSearch is debounced by 200ms
    await new Promise((resolve) => setTimeout(resolve, 250));

    const nameRow = findRow("name");
    const goldRow = findRow("gold");

    // Match is visible and highlighted …
    expect(nameRow.style.display).not.toBe("none");
    expect(nameRow.classList.contains("search-match")).toBe(true);
    // … but a sibling non-match is hidden.
    expect(goldRow.style.display).toBe("none");
    expect(document.getElementById("searchCount").textContent).toBe(
      "1 Treffer",
    );

    // Clearing the query restores everything.
    input.value = "";
    input.dispatchEvent(new Event("input"));
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(goldRow.style.display).not.toBe("none");
    expect(nameRow.classList.contains("search-match")).toBe(false);
    expect(document.getElementById("searchCount").textContent).toBe("");
  });

  test("importing a save file writes it to the resolved browser slot", async () => {
    const importedRaw = compressToBase64(JSON.stringify({ gold: 999 }));
    const sentCommands = [];

    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, callback) => {
          sentCommands.push(message);
          if (message.cmd === "getRpgMakerSaves") {
            callback({
              slots: [
                { key: "RPG File1", source: "localStorage", raw: "old" },
              ],
            });
            return;
          }
          if (message.cmd === "setRpgMakerSave") {
            callback({ success: true });
            return;
          }
          callback(null);
        }),
      },
      runtime: {},
    };

    document.body.innerHTML = `
      <div class="editor-toolbar">
        <select id="slotSelect"><option value="">--</option></select>
        <button id="refreshSlots" type="button">refresh</button>
        <button id="importSave" type="button">import</button>
        <input id="importSaveInput" type="file" />
        <button id="saveChanges" type="button" disabled>save</button>
        <button id="expandAll" type="button">expand</button>
        <button id="collapseAll" type="button">collapse</button>
      </div>
      <div id="searchBar" class="hidden">
        <input id="searchInput" />
        <span id="searchCount"></span>
      </div>
      <div id="statusMessage" class="hidden"></div>
      <div id="editorContent"></div>
    `;
    window.history.replaceState(
      {},
      "",
      "http://localhost/src/popup/save-editor.html?tabId=1",
    );

    await import("../../src/popup/save-editor.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settleAsyncWork();

    const input = document.getElementById("importSaveInput");
    const file = new File([importedRaw], "file6.rpgsave", {
      type: "application/octet-stream",
    });
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change"));

    for (let attempt = 0; attempt < 20; attempt++) {
      await settleAsyncWork();
      const confirmBtn = document.querySelector(".dialog-btn-confirm");
      if (confirmBtn) {
        confirmBtn.click();
        break;
      }
    }
    await settleAsyncWork();

    const writes = sentCommands.filter((m) => m.cmd === "setRpgMakerSave");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      key: "RPG File6",
      source: "localStorage",
      raw: importedRaw,
    });
  });
});
