/* global describe, test, expect, beforeEach */
import { jest } from "@jest/globals";

describe("service worker panel behavior", () => {
  afterEach(() => {
    delete globalThis.chrome;
  });

  describe("Chrome side panel", () => {
    beforeEach(() => {
      globalThis.chrome = {
        sidePanel: {
          setPanelBehavior: jest.fn().mockResolvedValue(),
          open: jest.fn(),
        },
        runtime: {
          onInstalled: { addListener: jest.fn() },
          onMessage: { addListener: jest.fn() },
          getURL: jest.fn(),
        },
        action: {
          onClicked: { addListener: jest.fn() },
        },
        permissions: {
          contains: jest.fn(),
          request: jest.fn(),
        },
        scripting: {
          executeScript: jest.fn(),
        },
      };
      jest.resetModules();
    });

    test("sets panel behavior on module load", async () => {
      await import("../../src/service-worker.js");
      expect(globalThis.chrome.sidePanel.setPanelBehavior).toHaveBeenCalledWith(
        {
          openPanelOnActionClick: true,
        }
      );
    });

    test("sets panel behavior when onInstalled fires", async () => {
      await import("../../src/service-worker.js");
      const listener =
        globalThis.chrome.runtime.onInstalled.addListener.mock.calls[0][0];
      globalThis.chrome.sidePanel.setPanelBehavior.mockClear();
      await listener({ reason: "install", previousVersion: "0.0.0" });
      expect(globalThis.chrome.sidePanel.setPanelBehavior).toHaveBeenCalledWith(
        {
          openPanelOnActionClick: true,
        }
      );
    });
  });

  describe("Firefox sidebar fallback", () => {
    beforeEach(() => {
      globalThis.chrome = {
        sidebarAction: {
          open: jest.fn(),
        },
        runtime: {
          onInstalled: { addListener: jest.fn() },
          onMessage: { addListener: jest.fn() },
          getURL: jest.fn(),
        },
        action: {
          onClicked: { addListener: jest.fn() },
        },
        permissions: {
          contains: jest.fn().mockResolvedValue(true),
          request: jest.fn(),
        },
        scripting: {
          executeScript: jest.fn(),
        },
      };
      jest.resetModules();
    });

    test("uses sidebarAction when sidePanel is unavailable", async () => {
      await import("../../src/service-worker.js");
      const listener =
        globalThis.chrome.action.onClicked.addListener.mock.calls[0][0];
      await listener({ id: 1, url: "https://example.com/" });
      expect(globalThis.chrome.sidebarAction.open).toHaveBeenCalled();
    });
  });
});
