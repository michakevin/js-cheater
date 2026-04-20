import { jest } from "@jest/globals";

async function settle() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
}

function setupDom() {
  document.body.innerHTML = `
    <div class="editor-tabs">
      <button class="tab-btn active" data-tab="values"></button>
      <button class="tab-btn" data-tab="items"></button>
    </div>
    <div id="statusMessage" class="hidden"></div>
    <div id="valuesTab" class="tab-panel active">
      <input id="valuesSearch" />
      <button id="refreshValues"></button>
      <div id="valuesContent"></div>
    </div>
    <div id="itemsTab" class="tab-panel hidden">
      <input id="itemsSearch" />
      <button id="refreshItems"></button>
      <div class="filter-btn active" data-type="items"></div>
      <div class="filter-btn" data-type="weapons"></div>
      <div class="filter-btn" data-type="armors"></div>
      <div id="itemsContent"></div>
    </div>
  `;
  window.history.replaceState(
    {},
    "",
    "http://localhost/src/popup/rpgmaker-data-editor.html?tabId=7",
  );
}

describe("rpgmaker-data-editor readPath response handling", () => {
  afterEach(() => {
    delete globalThis.chrome;
    jest.resetModules();
  });

  test("loadValues unwraps { value } from readPath for variables/switches", async () => {
    const variables = [null, 10, 20, 30];
    const switches = [null, true, false, true];

    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, cb) => {
          if (message.cmd === "getRpgMakerGameData") {
            cb({
              system: {
                variables: [null, "HP", "MP", "Gold"],
                switches: [null, "FlagA", "FlagB", "FlagC"],
              },
              items: [],
              weapons: [],
              armors: [],
            });
            return;
          }
          if (message.cmd === "readPath") {
            if (message.path === "$gameVariables._data") cb({ value: variables });
            else if (message.path === "$gameSwitches._data") cb({ value: switches });
            else cb({ value: null });
            return;
          }
          cb(null);
        }),
      },
      runtime: {},
    };

    setupDom();
    await import("../../src/popup/rpgmaker-data-editor.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settle();

    document.getElementById("refreshValues").click();
    await settle();
    await settle();

    const varInputs = document.querySelectorAll(
      "#valuesContent input.value-input",
    );
    expect(varInputs.length).toBe(3);
    expect(varInputs[0].value).toBe("10");
    expect(varInputs[1].value).toBe("20");
    expect(varInputs[2].value).toBe("30");

    const swInputs = document.querySelectorAll(
      "#valuesContent input.switch-checkbox",
    );
    expect(swInputs.length).toBe(3);
    expect(swInputs[0].checked).toBe(true);
    expect(swInputs[1].checked).toBe(false);
    expect(swInputs[2].checked).toBe(true);
  });

  test("loadItems unwraps { value } from readPath for party items", async () => {
    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, cb) => {
          if (message.cmd === "getRpgMakerGameData") {
            cb({
              system: { variables: [], switches: [] },
              items: [null, { name: "Potion", description: "heal", iconIndex: 1 }],
              weapons: [],
              armors: [],
            });
            return;
          }
          if (message.cmd === "readPath") {
            if (message.path === "$gameParty._items") cb({ value: { 1: 7 } });
            else if (message.path === "$gameParty._weapons") cb({ value: {} });
            else if (message.path === "$gameParty._armors") cb({ value: {} });
            else cb({ value: null });
            return;
          }
          cb(null);
        }),
      },
      runtime: {},
    };

    setupDom();
    await import("../../src/popup/rpgmaker-data-editor.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settle();

    document.getElementById("refreshItems").click();
    await settle();
    await settle();

    const qtyInput = document.querySelector(
      "#itemsContent input.item-qty-input",
    );
    expect(qtyInput).not.toBeNull();
    expect(qtyInput.value).toBe("7");
    expect(qtyInput.classList.contains("in-party")).toBe(true);
  });

  test("loadValues surfaces readPath error via status message", async () => {
    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, cb) => {
          if (message.cmd === "getRpgMakerGameData") {
            cb({
              system: { variables: [], switches: [] },
              items: [],
              weapons: [],
              armors: [],
            });
            return;
          }
          if (message.cmd === "readPath") {
            cb({ error: "Path not found at: $gameVariables" });
            return;
          }
          cb(null);
        }),
      },
      runtime: {},
    };

    setupDom();
    await import("../../src/popup/rpgmaker-data-editor.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await settle();

    document.getElementById("refreshValues").click();
    await settle();
    await settle();

    const status = document.getElementById("statusMessage");
    expect(status.textContent).toContain("Path not found");
    expect(status.classList.contains("hidden")).toBe(false);
  });
});
