// Function Lab — Pyodide Web Worker
// Pyodide нұсқасы бекітілген: 314.0.7 (CPython 3.14.2). Нұсқаны өзгертсең,
// осы URL-ді ғана өзгерт — басқа жерде runtime файлдарын араластырма.
const PYODIDE_VERSION = "314.0.7";
const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodideReadyPromise = null;
let pyodide = null;

// Әр "слот" (теория, болжау, әр нұсқа) үшін бөлек, таза Python namespace.
const namespaces = new Map();

function getNamespace(slot) {
  if (!namespaces.has(slot)) {
    namespaces.set(slot, pyodide.globals.get("dict")());
  }
  return namespaces.get(slot);
}

function resetNamespace(slot) {
  const ns = namespaces.get(slot);
  if (ns) {
    ns.destroy();
    namespaces.delete(slot);
  }
}

async function init() {
  if (pyodideReadyPromise) return pyodideReadyPromise;
  pyodideReadyPromise = (async () => {
    const { loadPyodide } = await import(`${PYODIDE_CDN_URL}pyodide.mjs`);
    pyodide = await loadPyodide({ indexURL: PYODIDE_CDN_URL });
    return true;
  })();
  return pyodideReadyPromise;
}

function classifyError(err) {
  // Pyodide.PythonError-дың .message өрісінде толық Python трейсбегі келеді.
  const raw = err && err.message ? String(err.message) : String(err);
  const lines = raw.trim().split("\n");
  const lastLine = lines[lines.length - 1] || raw;
  const match = lastLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
  const name = match ? match[1] : "Error";
  const message = match ? match[2] : lastLine;
  return { name, message, full: raw };
}

function pyValueToJs(value) {
  if (value === undefined || value === null) return { isNone: true, value: null, repr: "None" };
  try {
    if (typeof value.toJs === "function") {
      const converted = value.toJs();
      const repr = value.toString ? value.toString() : String(converted);
      if (typeof value.destroy === "function") value.destroy();
      if (converted === undefined || converted === null) return { isNone: true, value: null, repr: "None" };
      return { isNone: false, value: converted, repr };
    }
  } catch (e) {
    // толмады — төменде жай мәнге қайта ораймыз
  }
  if (value === true || value === false) return { isNone: false, value, repr: value ? "True" : "False" };
  return { isNone: false, value, repr: String(value) };
}

async function runInNamespace(slot, code) {
  const ns = getNamespace(slot);
  let stdoutChunks = [];
  let stderrChunks = [];
  pyodide.setStdout({ batched: (s) => stdoutChunks.push(s) });
  pyodide.setStderr({ batched: (s) => stderrChunks.push(s) });
  try {
    await pyodide.loadPackagesFromImports(code);
    const result = await pyodide.runPythonAsync(code, { globals: ns });
    if (result && typeof result.destroy === "function") result.destroy();
    return { ok: true, stdout: stdoutChunks.join("\n"), stderr: stderrChunks.join("\n") };
  } catch (err) {
    return { ok: false, stdout: stdoutChunks.join("\n"), stderr: stderrChunks.join("\n"), error: classifyError(err) };
  } finally {
    pyodide.setStdout({});
    pyodide.setStderr({});
  }
}

async function callFunction(slot, funcName, args) {
  const ns = getNamespace(slot);
  if (!ns.has(funcName)) {
    return { ok: false, error: { name: "NameError", message: `"${funcName}" атты функция табылмады`, full: `NameError: name '${funcName}' is not defined` } };
  }
  const func = ns.get(funcName);
  try {
    if (typeof func !== "function" && typeof func.callKwargs !== "function" && typeof func === "object" && typeof func.toString === "function" && !func.type) {
      // жалғастырамыз — төмендегі шақыру қатесі өзі ұсталады
    }
    const pyArgs = args.map((a) => pyodide.toPy(a));
    let rawResult;
    try {
      rawResult = func(...pyArgs);
    } finally {
      pyArgs.forEach((a) => { if (a && typeof a.destroy === "function") a.destroy(); });
    }
    const converted = pyValueToJs(rawResult);
    if (typeof func.destroy === "function") func.destroy();
    return { ok: true, ...converted };
  } catch (err) {
    if (typeof func.destroy === "function") func.destroy();
    return { ok: false, error: classifyError(err) };
  }
}

self.onmessage = async (event) => {
  const { id, cmd } = event.data;
  try {
    if (cmd === "init") {
      await init();
      self.postMessage({ id, type: "ready" });
      return;
    }
    await pyodideReadyPromise;
    if (cmd === "run") {
      const { slot, code } = event.data;
      const result = await runInNamespace(slot, code);
      self.postMessage({ id, type: "run-result", ...result });
    } else if (cmd === "call") {
      const { slot, funcName, args } = event.data;
      const result = await callFunction(slot, funcName, args);
      self.postMessage({ id, type: "call-result", ...result });
    } else if (cmd === "reset") {
      const { slot } = event.data;
      resetNamespace(slot);
      self.postMessage({ id, type: "reset-done" });
    }
  } catch (err) {
    self.postMessage({ id, type: "fatal-error", message: err && err.message ? err.message : String(err) });
  }
};
