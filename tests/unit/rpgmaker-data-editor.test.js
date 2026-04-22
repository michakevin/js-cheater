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
    <div id="actorsTab" class="tab-panel hidden">
      <input id="actorsSearch" />
      <button id="refreshActors"></button>
      <div id="actorsContent"></div>
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
            if (message.path === "$gameVariables._data")
              cb({ value: variables });
            else if (message.path === "$gameSwitches._data")
              cb({ value: switches });
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
              items: [
                null,
                { name: "Potion", description: "heal", iconIndex: 1 },
              ],
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

  test("loadActors renders editable fields and pokes correct paths", async () => {
    const actorsData = [
      null,
      {
        _name: "Elmia",
        _classId: 1,
        _level: 5,
        _hp: 191,
        _mp: 100,
        _tp: 0,
        _exp: { 1: 250 },
        _paramPlus: [0, 0, 0, 0, 0, 0, 0, -123],
      },
      {
        _name: "Bruno",
        _classId: 2,
        _level: 3,
        _hp: 80,
        _mp: 20,
        _tp: 0,
        _exp: { 2: 50 },
        _paramPlus: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];

    const pokeCalls = [];
    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, cb) => {
          if (message.cmd === "readPath") {
            if (message.path === "$gameActors._data") cb({ value: actorsData });
            else cb({ value: null });
            return;
          }
          if (message.cmd === "poke") {
            pokeCalls.push({ path: message.path, value: message.value });
            cb({ success: true });
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

    document.getElementById("refreshActors").click();
    await settle();
    await settle();

    const cards = document.querySelectorAll("#actorsContent .actor-card");
    expect(cards.length).toBe(2);

    const first = cards[0];
    expect(first.querySelector(".actor-name-input").value).toBe("Elmia");

    // 8 param inputs in grid
    const paramInputs = first.querySelectorAll(
      ".actor-params-grid .actor-small-input",
    );
    expect(paramInputs.length).toBe(8);
    expect(paramInputs[7].value).toBe("-123"); // LUK
    expect(paramInputs[7].dataset.path).toBe(
      "$gameActors._data[1]._paramPlus[7]",
    );

    // Change LUK → should poke the right path
    paramInputs[7].value = "99";
    paramInputs[7].dispatchEvent(new Event("change"));
    await settle();

    const lukPoke = pokeCalls.find(
      (p) => p.path === "$gameActors._data[1]._paramPlus[7]",
    );
    expect(lukPoke).toBeDefined();
    expect(lukPoke.value).toBe(99);

    // HP input is in actor-resources, first number input there
    const hpInput = first.querySelector(
      '.actor-resources input[data-path="$gameActors._data[1]._hp"]',
    );
    expect(hpInput).not.toBeNull();
    expect(hpInput.value).toBe("191");
    hpInput.value = "200";
    hpInput.dispatchEvent(new Event("change"));
    await settle();
    expect(
      pokeCalls.find((p) => p.path === "$gameActors._data[1]._hp")?.value,
    ).toBe(200);

    // Name change pokes text path
    const nameInput = first.querySelector(".actor-name-input");
    nameInput.value = "Hero";
    nameInput.dispatchEvent(new Event("change"));
    await settle();
    expect(
      pokeCalls.find((p) => p.path === "$gameActors._data[1]._name")?.value,
    ).toBe("Hero");

    // EXP path uses current classId
    const expInput = first.querySelector(
      '.actor-resources input[data-path="$gameActors._data[1]._exp[1]"]',
    );
    expect(expInput).not.toBeNull();
    expect(expInput.value).toBe("250");
  });

  test("loadActors filters by search input", async () => {
    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, cb) => {
          if (message.cmd === "readPath") {
            cb({
              value: [
                null,
                {
                  _name: "Elmia",
                  _classId: 1,
                  _level: 1,
                  _hp: 1,
                  _mp: 1,
                  _tp: 0,
                  _exp: { 1: 0 },
                  _paramPlus: [0, 0, 0, 0, 0, 0, 0, 0],
                },
                {
                  _name: "Bruno",
                  _classId: 1,
                  _level: 1,
                  _hp: 1,
                  _mp: 1,
                  _tp: 0,
                  _exp: { 1: 0 },
                  _paramPlus: [0, 0, 0, 0, 0, 0, 0, 0],
                },
              ],
            });
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

    document.getElementById("refreshActors").click();
    await settle();
    await settle();

    expect(document.querySelectorAll("#actorsContent .actor-card").length).toBe(
      2,
    );

    const search = document.getElementById("actorsSearch");
    search.value = "elm";
    search.dispatchEvent(new Event("input"));
    await settle();

    const cards = document.querySelectorAll("#actorsContent .actor-card");
    expect(cards.length).toBe(1);
    expect(cards[0].querySelector(".actor-name-input").value).toBe("Elmia");
  });

  test("switch change reverts UI and shows error when poke transport fails", async () => {
    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, cb) => {
          if (message.cmd === "getRpgMakerGameData") {
            cb({
              system: {
                variables: [null, "Var1"],
                switches: [null, "Sw1"],
              },
              items: [],
              weapons: [],
              armors: [],
            });
            return;
          }
          if (message.cmd === "readPath") {
            if (message.path === "$gameVariables._data") cb({ value: [null, 0] });
            else if (message.path === "$gameSwitches._data") cb({ value: [null, false] });
            else cb({ value: null });
            return;
          }
          if (message.cmd === "poke") {
            cb(null);
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
    await settle();

    const checkbox = document.querySelector(
      "#valuesContent input.switch-checkbox",
    );
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await settle();

    expect(checkbox.checked).toBe(false);
    const status = document.getElementById("statusMessage");
    expect(status.textContent).toContain("Scanner nicht erreichbar");
  });

  test("item qty change keeps cache/UI unchanged when poke transport fails", async () => {
    globalThis.chrome = {
      tabs: {
        sendMessage: jest.fn((tabId, message, cb) => {
          if (message.cmd === "getRpgMakerGameData") {
            cb({
              system: { variables: [], switches: [] },
              items: [null, { name: "Potion", description: "", iconIndex: 1 }],
              weapons: [],
              armors: [],
            });
            return;
          }
          if (message.cmd === "readPath") {
            if (message.path === "$gameParty._items") cb({ value: {} });
            else if (message.path === "$gameParty._weapons") cb({ value: {} });
            else if (message.path === "$gameParty._armors") cb({ value: {} });
            else cb({ value: null });
            return;
          }
          if (message.cmd === "poke") {
            cb(null);
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

    const qtyInput = document.querySelector("#itemsContent input.item-qty-input");
    expect(qtyInput).not.toBeNull();
    expect(qtyInput.classList.contains("in-party")).toBe(false);

    qtyInput.value = "5";
    qtyInput.dispatchEvent(new Event("change"));
    await settle();

    expect(qtyInput.classList.contains("in-party")).toBe(false);
    const status = document.getElementById("statusMessage");
    expect(status.textContent).toContain("Scanner nicht erreichbar");
  });
});
