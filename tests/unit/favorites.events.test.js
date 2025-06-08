/* global describe, test, expect, beforeEach, afterEach, jest */
import { jest } from "@jest/globals";

jest.mock("../../src/popup/communication.js", () => ({
  send: jest.fn(),
}));

import * as fav from "../../src/popup/favorites.js";
const {
  saveFavorite,
  updateFavorite,
  deleteFavorite,
  loadFavorites,
  setupFavoritesEventListeners,
} = fav;
import { send } from "../../src/popup/communication.js";

let favoritesKey;

beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = `
    <div id="favoritesContent"></div>
    <button class="tab-button active" data-tab="favorites"></button>
  `;
  localStorage.clear();
  globalThis.chrome = {
    tabs: {
      query: jest.fn().mockResolvedValue([{ url: "https://example.com" }]),
    },
  };
  favoritesKey = "cheat_favorites_https://example.com";
});

afterEach(() => {
  delete globalThis.chrome;
});

function getStoredFavorites() {
  return JSON.parse(localStorage.getItem(favoritesKey) || "{}");
}

function storeFavorites(favs) {
  localStorage.setItem(favoritesKey, JSON.stringify(favs));
}

async function waitTick() {
  await new Promise((r) => setTimeout(r, 0));
}

describe("favorite events", () => {
  test("saveFavorite stores new favorite and reloads list", async () => {
    jest.spyOn(window, "prompt").mockReturnValue("hpFav");
    await saveFavorite("player.hp", 10);
    await waitTick();
    const stored = getStoredFavorites();
    expect(Object.keys(stored).length).toBe(1);
    expect(Object.values(stored)[0].name).toBe("hpFav");
    expect(document.querySelector(".favorites-table")).not.toBeNull();
    window.prompt.mockRestore();
  });

  test("updateFavorite updates value on success", async () => {
    storeFavorites({ 1: { id: "1", name: "hp", path: "player.hp", value: 1 } });
    send.mockResolvedValue({ success: true });
    updateFavorite("1", 2);
    await waitTick();
    const stored = getStoredFavorites();
    expect(stored["1"].value).toBe(2);
    expect(send).toHaveBeenCalledWith("poke", { path: "player.hp", value: 2 });
    expect(
      document.querySelector(".favorites-table tbody").textContent
    ).toContain("2");
  });

  test("updateFavorite does not update on failure", async () => {
    storeFavorites({ 1: { id: "1", name: "hp", path: "player.hp", value: 1 } });
    send.mockResolvedValue({ success: false, error: "fail" });
    updateFavorite("1", 2);
    await waitTick();
    const stored = getStoredFavorites();
    expect(stored["1"].value).toBe(1);
    expect(send).toHaveBeenCalled();
    const tbody = document.querySelector(".favorites-table tbody");
    if (tbody) {
      expect(tbody.textContent).not.toContain("2");
    }
  });

  test("deleteFavorite removes favorite", async () => {
    storeFavorites({ 1: { id: "1", name: "hp", path: "player.hp", value: 1 } });
    await deleteFavorite("1");
    await waitTick();
    const stored = getStoredFavorites();
    expect(Object.keys(stored).length).toBe(0);
    expect(document.querySelector(".no-favorites")).not.toBeNull();
  });

  test("freeze and unfreeze send messages", async () => {
    storeFavorites({ 1: { id: "1", name: "hp", path: "player.hp", value: 1 } });
    await loadFavorites();
    await waitTick();
    setupFavoritesEventListeners();
    const btn = document.querySelector(".freeze-btn");
    expect(btn).not.toBeNull();
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitTick();
    expect(send).toHaveBeenCalledWith("freeze", { path: "player.hp", value: 1 });
    expect(btn.classList.contains("active")).toBe(true);
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitTick();
    expect(send).toHaveBeenCalledWith("unfreeze", { path: "player.hp" });
    expect(btn.classList.contains("active")).toBe(false);
  });
});
