(() => {
  const DEBUG = false;
  if (DEBUG) console.log("[js-cheater] Content script loaded (postMessage Mode)");

  const REQ = "__jsCheaterRequest";
  const RES = "__jsCheaterResponse";

  const API = {
    async sendCommand(command, data = {}) {
      const id =
        "req_" + Date.now() + "_" + Math.random().toString(36).slice(2);

      return new Promise((resolve) => {
        const cb = (ev) => {
          if (
            ev.source !== window ||
            ev.data?.type !== RES ||
            ev.data.id !== id
          )
            return;
          window.removeEventListener("message", cb);
          resolve(ev.data.result);
        };

        window.addEventListener("message", cb, false);
        window.postMessage({ type: REQ, id, command, data }, "*");

        setTimeout(() => {
          window.removeEventListener("message", cb);
          resolve({ error: "Timeout", timeout: true });
        }, 10000);
      });
    },

    async start(value) {
      return this.sendCommand("scan", { value });
    },

    async refine(value) {
      return this.sendCommand("refine", { value });
    },

    async scanByName(name) {
      return this.sendCommand("scanByName", { name });
    },

    async refineByName(name) {
      return this.sendCommand("refineByName", { name });
    },

    async list() {
      return this.sendCommand("list");
    },

    async poke(idx, value) {
      return this.sendCommand("poke", { idx, value });
    },

    async pokeByPath(path, value) {
      return this.sendCommand("poke", { path, value });
    },

    async freezeByPath(path, value) {
      return this.sendCommand("freeze", { path, value });
    },

    async unfreezeByPath(path) {
      return this.sendCommand("unfreeze", { path });
    },

    async test() {
      return this.sendCommand("test");
    },
  };

  const commandHandlers = {
    ping: () => "pong",
    start: (msg) => API.start(msg.value),
    scanByName: (msg) => API.scanByName(msg.value),
    refine: (msg) => API.refine(msg.value),
    refineByName: (msg) => API.refineByName(msg.value),
    list: () => API.list(),
    poke: (msg) =>
      msg.path ? API.pokeByPath(msg.path, msg.value) : API.poke(msg.idx, msg.value),
    freeze: (msg) => API.freezeByPath(msg.path, msg.value),
    unfreeze: (msg) => API.unfreezeByPath(msg.path),
    getLocalStorage: () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    },
    setLocalStorage: (msg) => {
      Object.entries(msg.data || {}).forEach(([k, v]) => {
        try {
          localStorage.setItem(k, v);
        } catch (e) {
          console.error("[js-cheater] Failed to set", k, e);
        }
      });
      return { success: true };
    },
    test: () => API.test(),
  };

  // Message Handler
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (DEBUG && msg.cmd !== "test") {
      console.log("[js-cheater] Received message:", msg);
    }

    const handler = commandHandlers[msg.cmd];
    if (!handler) {
      sendResponse({ error: "Unknown command: " + msg.cmd });
      return;
    }

    try {
      const result = handler(msg);
      if (result && typeof result.then === "function") {
        result.then((res) => {
          if (DEBUG && msg.cmd !== "test") {
            console.log(`[js-cheater] ${msg.cmd} result:`, res);
          }
          sendResponse(res);
        });
        return true;
      }
      sendResponse(result);
    } catch (e) {
      console.error(`[js-cheater] Handler for ${msg.cmd} failed:`, e);
      sendResponse({ error: e.message });
    }
  });
})();
