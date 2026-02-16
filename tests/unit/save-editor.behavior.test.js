import { jest } from "@jest/globals";
import { compressToBase64 } from "../../src/popup/lz-string.js";

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
              slots: [{ key: "RPG File1", source: "localStorage", raw: slotRaw }],
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
});
