import { jest } from "@jest/globals";

jest.mock("../../src/popup/dialog.js", () => ({
  showDialog: jest.fn(),
}));

function renderFavoritesDom() {
  document.body.innerHTML = `
    <select id="favoritesDomainSelect"></select>
    <button id="adoptFavoritesForCurrentDomain" class="hidden"></button>
    <button id="exportFavorites"></button>
    <button id="importFavorites"></button>
    <input id="importFavoritesFile" type="file" />
    <div id="favoritesContent"></div>
  `;
}

async function loadModule(url) {
  jest.resetModules();
  globalThis.chrome = {
    tabs: {
      query: jest.fn().mockResolvedValue([{ url }]),
    },
  };
  return await import("../../src/popup/favorites.js");
}

async function waitTick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("domain isolated favorites", () => {
  beforeEach(() => {
    renderFavoritesDom();
    localStorage.clear();
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  test("loads favorites for the current domain only", async () => {
    const favsA = { 1: { id: "1", name: "favA", path: "a", value: 1 } };
    const favsB = { 2: { id: "2", name: "favB", path: "b", value: 2 } };
    localStorage.setItem(
      "cheat_favorites_https://a.com",
      JSON.stringify(favsA),
    );
    localStorage.setItem(
      "cheat_favorites_https://b.com",
      JSON.stringify(favsB),
    );

    const { loadFavorites } = await loadModule("https://a.com/x");
    await loadFavorites();

    const html = document.getElementById("favoritesContent").innerHTML;
    expect(html).toContain("favA");
    expect(html).not.toContain("favB");
  });

  test("switching domains shows the correct favorites", async () => {
    const favsA = { 1: { id: "1", name: "favA", path: "a", value: 1 } };
    const favsB = { 2: { id: "2", name: "favB", path: "b", value: 2 } };
    localStorage.setItem(
      "cheat_favorites_https://a.com",
      JSON.stringify(favsA),
    );
    localStorage.setItem(
      "cheat_favorites_https://b.com",
      JSON.stringify(favsB),
    );

    let mod = await loadModule("https://a.com/home");
    await mod.loadFavorites();
    let html = document.getElementById("favoritesContent").innerHTML;
    expect(html).toContain("favA");
    expect(html).not.toContain("favB");

    renderFavoritesDom();
    mod = await loadModule("https://b.com/home");
    await mod.loadFavorites();
    html = document.getElementById("favoritesContent").innerHTML;
    expect(html).toContain("favB");
    expect(html).not.toContain("favA");
  });

  test("updates favorites on active-tab change in same popup session", async () => {
    jest.resetModules();
    globalThis.chrome = {
      tabs: {
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 1, url: "https://a.com/home" }])
          .mockResolvedValueOnce([{ id: 2, url: "https://b.com/home" }]),
      },
    };

    const favsA = { 1: { id: "1", name: "favA", path: "a", value: 1 } };
    const favsB = { 2: { id: "2", name: "favB", path: "b", value: 2 } };
    localStorage.setItem(
      "cheat_favorites_https://a.com",
      JSON.stringify(favsA),
    );
    localStorage.setItem(
      "cheat_favorites_https://b.com",
      JSON.stringify(favsB),
    );

    const mod = await import("../../src/popup/favorites.js");
    await mod.loadFavorites();
    let html = document.getElementById("favoritesContent").innerHTML;
    expect(html).toContain("favA");
    expect(html).not.toContain("favB");

    await mod.loadFavorites();
    html = document.getElementById("favoritesContent").innerHTML;
    expect(html).toContain("favB");
    expect(html).not.toContain("favA");
  });

  test("domain selector lists saved domains and preselects active domain", async () => {
    const favsA = { 1: { id: "1", name: "favA", path: "a", value: 1 } };
    const favsB = { 2: { id: "2", name: "favB", path: "b", value: 2 } };
    localStorage.setItem(
      "cheat_favorites_https://a.com",
      JSON.stringify(favsA),
    );
    localStorage.setItem(
      "cheat_favorites_https://b.com",
      JSON.stringify(favsB),
    );

    const { loadFavorites } = await loadModule("https://b.com/home");
    await loadFavorites();

    const select = document.getElementById("favoritesDomainSelect");
    const values = [...select.options].map((option) => option.value);
    expect(values).toContain("https://a.com");
    expect(values).toContain("https://b.com");
    expect(select.value).toBe("https://b.com");
  });

  test("can copy selected domain favorites to the current domain", async () => {
    const favsA = {
      1: { id: "1", name: "favA", path: "player.hp", value: 99 },
      2: { id: "2", name: "favB", path: "player.gold", value: 1337 },
    };
    const favsB = {
      9: { id: "9", name: "already", path: "player.hp", value: 1 },
    };
    localStorage.setItem(
      "cheat_favorites_https://a.com",
      JSON.stringify(favsA),
    );
    localStorage.setItem(
      "cheat_favorites_https://b.com",
      JSON.stringify(favsB),
    );

    const mod = await loadModule("https://b.com/home");
    await mod.loadFavorites();

    const select = document.getElementById("favoritesDomainSelect");
    select.value = "https://a.com";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await waitTick();

    const importButton = document.getElementById(
      "adoptFavoritesForCurrentDomain",
    );
    expect(importButton.classList.contains("hidden")).toBe(false);
    importButton.click();
    await waitTick();

    const storedCurrent = JSON.parse(
      localStorage.getItem("cheat_favorites_https://b.com") || "{}",
    );
    const storedPaths = Object.values(storedCurrent).map((fav) => fav.path);
    expect(storedPaths).toContain("player.hp");
    expect(storedPaths).toContain("player.gold");
    expect(storedPaths.filter((path) => path === "player.hp")).toHaveLength(1);
    expect(select.value).toBe("https://b.com");
  });
});
