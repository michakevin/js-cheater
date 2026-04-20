import { parsePath } from "../../src/parse-path.js";

describe("parsePath", () => {
  test("splits dotted identifiers", () => {
    expect(parsePath("a.b.c")).toEqual(["a", "b", "c"]);
  });

  test("parses numeric bracket indices as numbers", () => {
    expect(parsePath("arr[0][12]")).toEqual(["arr", 0, 12]);
  });

  test("unquotes bracketed string keys", () => {
    expect(parsePath("obj['foo']")).toEqual(["obj", "foo"]);
    expect(parsePath('obj["foo"]')).toEqual(["obj", "foo"]);
  });

  test("preserves numeric-looking keys when quoted", () => {
    expect(parsePath("obj['123']")).toEqual(["obj", "123"]);
  });

  test("handles escaped quotes inside keys", () => {
    expect(parsePath(`obj["a\\"b"]`)).toEqual(["obj", 'a"b']);
  });

  test("handles bracket characters inside quoted keys", () => {
    expect(parsePath(`obj["a]b"]`)).toEqual(["obj", "a]b"]);
    expect(parsePath(`obj["a[b"]`)).toEqual(["obj", "a[b"]);
  });

  test("returns empty array for empty input", () => {
    expect(parsePath("")).toEqual([]);
    expect(parsePath(null)).toEqual([]);
  });

  test("mixes identifiers and indices", () => {
    expect(parsePath("$gameVariables._data[42]")).toEqual([
      "$gameVariables",
      "_data",
      42,
    ]);
  });
});
