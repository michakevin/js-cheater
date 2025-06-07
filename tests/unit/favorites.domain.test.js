/* global describe, test, expect, beforeEach */
import { jest } from "@jest/globals";

async function loadModule(url) {
  jest.resetModules();
  globalThis.chrome = {
    tabs: {
      query: jest.fn().mockResolvedValue([{ url }]),
    },
  };
  return await import("../../src/popup/favorites.js");
}

describe("domain isolated favorites", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="favoritesContent"></div>';
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
      JSON.stringify(favsA)
    );
    localStorage.setItem(
      "cheat_favorites_https://b.com",
      JSON.stringify(favsB)
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
      JSON.stringify(favsA)
    );
    localStorage.setItem(
      "cheat_favorites_https://b.com",
      JSON.stringify(favsB)
    );

    let mod = await loadModule("https://a.com/home");
    await mod.loadFavorites();
    let html = document.getElementById("favoritesContent").innerHTML;
    expect(html).toContain("favA");
    expect(html).not.toContain("favB");

    document.body.innerHTML = '<div id="favoritesContent"></div>';
    mod = await loadModule("https://b.com/home");
    await mod.loadFavorites();
    html = document.getElementById("favoritesContent").innerHTML;
    expect(html).toContain("favB");
    expect(html).not.toContain("favA");
  });
});
