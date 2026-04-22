import { jest } from "@jest/globals";

jest.mock("../../src/popup/communication.js", () => ({
  sendTabMessage: jest.fn(),
}));

import { createTabSender } from "../../src/popup/editor-shell.js";
import { sendTabMessage } from "../../src/popup/communication.js";

describe("editor-shell createTabSender", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("accepts tabId 0 as valid id", async () => {
    sendTabMessage.mockResolvedValue({ ok: true });
    const send = createTabSender(() => 0);

    const result = await send("test", { value: 1 });

    expect(sendTabMessage).toHaveBeenCalledWith(0, { cmd: "test", value: 1 });
    expect(result).toEqual({ ok: true });
  });

  test("throws only when tabId is nullish", async () => {
    const send = createTabSender(() => null, "missing tab");
    await expect(send("test")).rejects.toThrow("missing tab");
    expect(sendTabMessage).not.toHaveBeenCalled();
  });
});
