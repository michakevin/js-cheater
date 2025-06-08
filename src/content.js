(() => {
  console.log("[js-cheater] Content script loaded (postMessage Mode)");

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
          resolve({ error: "Timeout" });
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

  // Message Handler
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.cmd !== "test") {
      console.log("[js-cheater] Received message:", msg);
    }

    switch (msg.cmd) {
      case "ping":
        sendResponse("pong");
        break;
      case "start":
        API.start(msg.value).then((result) => {
          console.log("[js-cheater] Start result:", result);
          sendResponse(result);
        });
        return true;
      case "scanByName":
        API.scanByName(msg.value).then((result) => {
          console.log("[js-cheater] scanByName result:", result);
          sendResponse(result);
        });
        return true;
      case "refine":
        API.refine(msg.value).then((result) => {
          console.log("[js-cheater] Refine result:", result);
          sendResponse(result);
        });
        return true;
      case "refineByName":
        API.refineByName(msg.value).then((result) => {
          console.log("[js-cheater] refineByName result:", result);
          sendResponse(result);
        });
        return true;
      case "list":
        API.list().then((result) => {
          console.log("[js-cheater] List result:", result);
          sendResponse(result);
        });
        return true;
      case "poke":
        // Check if it's a path-based poke (for favorites) or index-based poke (for search results)
        if (msg.path) {
          API.pokeByPath(msg.path, msg.value).then((result) => {
            console.log("[js-cheater] PokeByPath result:", result);
            sendResponse(result);
          });
        } else {
          API.poke(msg.idx, msg.value).then((result) => {
            console.log("[js-cheater] Poke result:", result);
            sendResponse(result);
          });
        }
        return true;
      case "freeze":
        API.freezeByPath(msg.path, msg.value).then((result) => {
          console.log("[js-cheater] Freeze result:", result);
          sendResponse(result);
        });
        return true;
      case "unfreeze":
        API.unfreezeByPath(msg.path).then((result) => {
          console.log("[js-cheater] Unfreeze result:", result);
          sendResponse(result);
        });
        return true;
      case "getLocalStorage": {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          data[key] = localStorage.getItem(key);
        }
        sendResponse(data);
        break;
      }
      case "setLocalStorage":
        Object.entries(msg.data || {}).forEach(([k, v]) => {
          try {
            localStorage.setItem(k, v);
          } catch (e) {
            console.error("[js-cheater] Failed to set", k, e);
          }
        });
        sendResponse({ success: true });
        break;
      case "test":
        API.test().then((result) => {
          console.log("[js-cheater] Test result:", result);
          sendResponse(result);
        });
        return true;
      default:
        sendResponse({ error: "Unknown command: " + msg.cmd });
    }
  });
})();
