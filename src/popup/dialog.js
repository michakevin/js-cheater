/**
 * Custom dialog module – replaces native alert/confirm/prompt with
 * styled in-popup modals that respect the current theme.
 */

/**
 * Show a custom dialog inside the popup.
 *
 * @param {object} options
 * @param {"alert"|"confirm"|"prompt"} options.type
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {string} [options.defaultValue]  – only for type "prompt"
 * @param {string} [options.confirmText]
 * @param {string} [options.cancelText]
 * @param {string} [options.placeholder]   – only for type "prompt"
 * @returns {Promise<string|boolean|null>}
 *   - alert  → true (acknowledged)
 *   - confirm → true | false
 *   - prompt  → string | null (cancelled)
 */
export function showDialog({
  type = "alert",
  title = "",
  message = "",
  defaultValue = "",
  confirmText,
  cancelText,
  placeholder = "",
}) {
  return new Promise((resolve) => {
    // Defaults per type
    if (!confirmText) confirmText = type === "alert" ? "OK" : "Bestätigen";
    if (!cancelText) cancelText = "Abbrechen";

    // --- Build DOM ---
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    if (title) overlay.setAttribute("aria-label", title);

    const box = document.createElement("div");
    box.className = "dialog-box";

    // Title
    if (title) {
      const h = document.createElement("div");
      h.className = "dialog-title";
      h.textContent = title;
      box.appendChild(h);
    }

    // Message
    if (message) {
      const p = document.createElement("div");
      p.className = "dialog-message";
      p.textContent = message;
      box.appendChild(p);
    }

    // Input (prompt only)
    let input = null;
    if (type === "prompt") {
      input = document.createElement("input");
      input.className = "dialog-input";
      input.type = "text";
      input.value = defaultValue;
      if (placeholder) input.placeholder = placeholder;
      box.appendChild(input);
    }

    // Button row
    const btnRow = document.createElement("div");
    btnRow.className = "dialog-buttons";

    function cleanup(value) {
      overlay.remove();
      resolve(value);
    }

    if (type !== "alert") {
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "dialog-btn dialog-btn-cancel";
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener("click", () =>
        cleanup(type === "confirm" ? false : null),
      );
      btnRow.appendChild(cancelBtn);
    }

    const okBtn = document.createElement("button");
    okBtn.className = "dialog-btn dialog-btn-confirm";
    okBtn.textContent = confirmText;
    okBtn.addEventListener("click", () => {
      if (type === "prompt") {
        cleanup(input.value);
      } else if (type === "confirm") {
        cleanup(true);
      } else {
        cleanup(true);
      }
    });
    btnRow.appendChild(okBtn);

    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Keyboard handling
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        overlay.removeEventListener("keydown", onKeyDown);
        if (type === "alert") cleanup(true);
        else if (type === "confirm") cleanup(false);
        else cleanup(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        overlay.removeEventListener("keydown", onKeyDown);
        if (type === "prompt") cleanup(input.value);
        else if (type === "confirm") cleanup(true);
        else cleanup(true);
      }
    }
    overlay.addEventListener("keydown", onKeyDown);

    // Backdrop click = cancel
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        if (type === "alert") cleanup(true);
        else if (type === "confirm") cleanup(false);
        else cleanup(null);
      }
    });

    // Focus management
    requestAnimationFrame(() => {
      if (input) {
        input.focus();
        input.select();
      } else {
        okBtn.focus();
      }
    });
  });
}
