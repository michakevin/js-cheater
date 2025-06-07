/* global describe, test, expect, beforeEach, jest */
import {
  parsePath,
  loadFavorites,
  importFavoritesFromText,
  exportFavorites,
  renameFavorite,
} from "../../src/popup/favorites.js";

afterEach(() => {
  delete globalThis.chrome;
});

describe("parsePath", () => {
  test("parses dot notation paths", () => {
    expect(parsePath("foo.bar.baz")).toEqual(["foo", "bar", "baz"]);
  });

  test("parses array indices and quoted parts", () => {
    expect(parsePath("foo['bar'][0]")).toEqual(["foo", "bar", 0]);
  });

  test("handles escaped quotes inside brackets", () => {
    expect(parsePath("foo['ba\\'r']")).toEqual(["foo", "ba'r"]);
  });
});

describe("loadFavorites", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="favoritesContent"></div>';
    localStorage.clear();
    globalThis.chrome = {
      tabs: {
        query: jest
          .fn()
          .mockResolvedValue([{ url: "https://example.com/page" }]),
      },
    };
  });

  test("escapes HTML in favorite names", async () => {
    const favs = {
      1: { id: "1", name: "<img>", path: "foo", value: 1 },
    };
    const key = "cheat_favorites_https://example.com";
    localStorage.setItem(key, JSON.stringify(favs));
    await loadFavorites();
    const firstTd = document.querySelector(".favorites-table tbody td");
    expect(firstTd.innerHTML).toBe("&lt;img&gt;");
  });
});

describe("import/export favorites", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="favoritesContent"></div>';
    localStorage.clear();
    globalThis.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ url: "https://example.com" }]),
      },
    };
  });

  test("importFavoritesFromText stores favorites", async () => {
    const json = JSON.stringify([{ name: "hp", path: "player.hp", value: 1 }]);
    await importFavoritesFromText(json);
    const key = "cheat_favorites_https://example.com";
    const stored = JSON.parse(localStorage.getItem(key));
    expect(Object.keys(stored).length).toBe(1);
    const fav = Object.values(stored)[0];
    expect(fav.path).toBe("player.hp");
  });

  test("exportFavorites triggers download", async () => {
    const key = "cheat_favorites_https://example.com";
    localStorage.setItem(
      key,
      JSON.stringify({ a: { id: "a", name: "n", path: "p", value: 1 } })
    );

    let createUrlMock;
    if (URL.createObjectURL) {
      createUrlMock = jest
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:url");
    } else {
      URL.createObjectURL = jest.fn(() => "blob:url");
      createUrlMock = URL.createObjectURL;
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = jest.fn();
    } else {
      jest.spyOn(URL, "revokeObjectURL");
    }
    const clickMock = jest.fn();
    const origCreate = document.createElement;
    document.createElement = jest.fn((tag) => {
      const el = origCreate.call(document, tag);
      if (tag === "a") {
        el.click = clickMock;
      }
      return el;
    });

    await exportFavorites();

    expect(createUrlMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();

    if (createUrlMock.mockRestore) {
      createUrlMock.mockRestore();
    }
    if (URL.revokeObjectURL.mockRestore) {
      URL.revokeObjectURL.mockRestore();
    }
    document.createElement = origCreate;
  });
});

describe("renameFavorite", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="favoritesContent"></div>';
    localStorage.clear();
    globalThis.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ url: "https://example.com" }]),
      },
    };
  });

  test("updates the name of a favorite", async () => {
    const key = "cheat_favorites_https://example.com";
    const favs = { 1: { id: "1", name: "old", path: "p", value: 1 } };
    localStorage.setItem(key, JSON.stringify(favs));
    await renameFavorite("1", "new");
    const stored = JSON.parse(localStorage.getItem(key));
    expect(stored["1"].name).toBe("new");
  });
});
