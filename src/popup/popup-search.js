import { $, tryParse } from "./utils.js";
import { send } from "./communication.js";
import {
  showInitialScanState,
  showRefineScanState,
  showLoading,
  showEmptyState,
  setScanButtonsDisabled,
  updateList,
} from "./ui.js";
import { showError } from "./messages.js";

async function runSearch({ cmd, value, name }) {
  const extra = { value };
  if (name !== undefined) extra.name = name;
  const result = await send(cmd, extra);
  if (result !== null) {
    if (typeof result === "object") {
      if (result.error) {
        showError(`❌ ${result.error}`);
      } else {
        showError(`⚠️ Unerwartete Antwort: ${JSON.stringify(result)}`);
      }
      return null;
    }
    return result;
  }
  return null;
}

async function executeSearch({
  cmd,
  value,
  name,
  loadingMessage,
  successMessage,
  showRefineState = false,
}) {
  showLoading(loadingMessage);
  setScanButtonsDisabled(true);
  const result = await runSearch({ cmd, value, name });
  setScanButtonsDisabled(false);

  if (result !== null) {
    showError(successMessage(result));
    if (showRefineState) {
      showRefineScanState();
    }
    setTimeout(updateList, 100);
  }
}

async function resetSearch(valueInput) {
  await send("start", { value: "__RESET_SCAN__" + Math.random() });
  showInitialScanState();
  showEmptyState();
  valueInput.focus();
}

function getSearchInput({ type, rawValue, nameInput }) {
  if (type === "nameAndValue") {
    const value = tryParse(rawValue);
    const name = nameInput.value.trim();
    if (value === "" || name === "") {
      showError("Bitte Wert und Name eingeben");
      return null;
    }
    return { value, name };
  }

  const value = type === "value" ? tryParse(rawValue) : rawValue.trim();
  if (value === "") {
    showError("Bitte einen Wert eingeben");
    return null;
  }
  return { value };
}

function getScanCommand(type, byMode) {
  if (type === "nameAndValue") return byMode.nameAndValue;
  if (type === "value") return byMode.value;
  return byMode.name;
}

export function setupSearchTypeUI({
  searchTypeSelect,
  nameInputGroup,
  valueInput,
}) {
  function updateSearchTypeUI() {
    const type = searchTypeSelect.value;
    if (type === "nameAndValue") {
      nameInputGroup.classList.remove("hidden");
      valueInput.placeholder = 'z. B. 123 oder "gold"';
    } else {
      nameInputGroup.classList.add("hidden");
      if (type === "name") {
        valueInput.placeholder = 'z. B. "hp" oder "score"';
      } else {
        valueInput.placeholder = 'z. B. 123 oder "gold"';
      }
    }
  }

  searchTypeSelect.addEventListener("change", updateSearchTypeUI);
  updateSearchTypeUI();
}

export function createSearchHandlers({ searchTypeSelect, valueInput, nameInput }) {
  async function onStart() {
    const type = searchTypeSelect.value;
    const input = getSearchInput({
      type,
      rawValue: valueInput.value,
      nameInput,
    });
    if (!input) return;

    await executeSearch({
      cmd: getScanCommand(type, {
        value: "start",
        name: "scanByName",
        nameAndValue: "scanByNameAndValue",
      }),
      value: input.value,
      name: input.name,
      loadingMessage: "Scanne...",
      successMessage: (result) => `✅ ${result} Treffer gefunden`,
      showRefineState: true,
    });
  }

  async function onRefine() {
    const type = searchTypeSelect.value;
    const input = getSearchInput({
      type,
      rawValue: valueInput.value,
      nameInput,
    });
    if (!input) return;

    await executeSearch({
      cmd: getScanCommand(type, {
        value: "refine",
        name: "refineByName",
        nameAndValue: "refineByNameAndValue",
      }),
      value: input.value,
      name: input.name,
      loadingMessage: "Verfeinere...",
      successMessage: (result) => `🔬 ${result} Treffer nach Verfeinerung`,
    });
  }

  async function onNewSearch() {
    const type = searchTypeSelect.value;
    const raw = valueInput.value;

    if (type === "nameAndValue") {
      const value = tryParse(raw);
      const name = nameInput.value.trim();

      if (value !== "" && name !== "") {
        await executeSearch({
          cmd: "scanByNameAndValue",
          value,
          name,
          loadingMessage: "Neue Suche...",
          successMessage: (result) => `✅ ${result} Treffer gefunden`,
          showRefineState: true,
        });
        return;
      }
      await resetSearch(valueInput);
      return;
    }

    const value = type === "value" ? tryParse(raw) : raw.trim();
    if (value !== "") {
      await executeSearch({
        cmd: type === "value" ? "start" : "scanByName",
        value,
        loadingMessage: "Neue Suche...",
        successMessage: (result) => `✅ ${result} Treffer gefunden`,
        showRefineState: true,
      });
      return;
    }
    await resetSearch(valueInput);
  }

  function handleEnterKey(event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    const refineGroup = $("#refineScanGroup");
    if (refineGroup && !refineGroup.classList.contains("hidden")) {
      void onRefine();
    } else {
      void onStart();
    }
  }

  return {
    onStart,
    onRefine,
    onNewSearch,
    handleEnterKey,
  };
}
