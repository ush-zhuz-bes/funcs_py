// Function Lab — Pyodide worker-мен жұмыс істейтін негізгі ағын оболочкасы.
// Барлық Python орындаулары осы бір модуль арқылы өтеді, себебі worker
// бір сәтте тек бір кодты орындай алады.

const RUN_TIMEOUT_MS = 10000;

class PyRunner {
  constructor() {
    this.worker = null;
    this.nextId = 1;
    this.pending = new Map();
    this.statusListeners = new Set();
    this.status = "idle"; // idle | loading | ready | running | error
    this.queue = Promise.resolve();
    this._spawnWorker();
  }

  onStatus(fn) {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  _setStatus(status) {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  _spawnWorker() {
    this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = (event) => this._handleMessage(event.data);
    this.worker.onerror = (event) => {
      this._setStatus("error");
      this.pending.forEach((p) => p.reject(new Error("Worker қатесі: " + event.message)));
      this.pending.clear();
    };
    this._setStatus("loading");
    const id = this.nextId++;
    const readyPromise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.worker.postMessage({ id, cmd: "init" });
    this.readyPromise = readyPromise.then(
      () => { this._setStatus("ready"); return true; },
      (err) => { this._setStatus("error"); throw err; }
    );
  }

  _handleMessage(data) {
    const { id } = data;
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    if (data.type === "fatal-error") {
      p.reject(new Error(data.message));
      return;
    }
    p.resolve(data);
  }

  _send(cmd, payload) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.worker.postMessage({ id, cmd, ...payload });
    return promise;
  }

  async _restart() {
    try { this.worker.terminate(); } catch (e) { /* елеме */ }
    this.pending.forEach((p) => p.reject(new Error("restarted")));
    this.pending.clear();
    this._spawnWorker();
    await this.readyPromise;
  }

  /** Кезекке қойып, бір-бірден орындайды (worker жалғыз болғандықтан). */
  _enqueue(task) {
    const result = this.queue.then(task, task);
    this.queue = result.then(() => {}, () => {});
    return result;
  }

  async _withTimeout(promise, onTimeout) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("TIMEOUT")), RUN_TIMEOUT_MS);
    });
    try {
      return await Promise.race([promise, timeout]);
    } catch (err) {
      if (err && err.message === "TIMEOUT") {
        this._setStatus("loading");
        await this._restart();
        this._setStatus("ready");
        if (onTimeout) onTimeout();
        throw new Error("TIMEOUT");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async waitReady() {
    await this.readyPromise;
  }

  /** Кодты slot атауы бойынша таза namespace-те орындайды. */
  run(slot, code) {
    return this._enqueue(async () => {
      try {
        await this.readyPromise;
      } catch (e) {
        return { ok: false, stdout: "", stderr: "", loadError: true,
          error: { name: "Python ортасы жүктелмеді", message: "Интернет байланысын тексеріп, бетті жаңартыңыз. Кодты .py ретінде жүктеп, компьютердегі Python ортасында орындауға болады.", full: "" } };
      }
      this._setStatus("running");
      try {
        const res = await this._withTimeout(this._send("run", { slot, code }));
        this._setStatus("ready");
        return res;
      } catch (err) {
        if (err && err.message === "TIMEOUT") {
          return { ok: false, stdout: "", stderr: "", timeout: true,
            error: { name: "Уақыт аяқталды", message: "Код 10 секундте аяқталмады (шексіз цикл болуы мүмкін). Python ортасы қайта іске қосылды.", full: "" } };
        }
        this._setStatus("ready");
        throw err;
      }
    });
  }

  call(slot, funcName, args) {
    return this._enqueue(async () => {
      try {
        await this.readyPromise;
      } catch (e) {
        return { ok: false, loadError: true,
          error: { name: "Python ортасы жүктелмеді", message: "Интернет байланысын тексеріп, бетті жаңартыңыз. Кодты .py ретінде жүктеп, компьютердегі Python ортасында орындауға болады.", full: "" } };
      }
      this._setStatus("running");
      try {
        const res = await this._withTimeout(this._send("call", { slot, funcName, args }));
        this._setStatus("ready");
        return res;
      } catch (err) {
        if (err && err.message === "TIMEOUT") {
          return { ok: false, timeout: true,
            error: { name: "Уақыт аяқталды", message: "Функция 10 секундте аяқталмады. Python ортасы қайта іске қосылды.", full: "" } };
        }
        this._setStatus("ready");
        throw err;
      }
    });
  }

  reset(slot) {
    return this._enqueue(async () => {
      await this.readyPromise;
      return this._send("reset", { slot });
    });
  }

  /** Қолмен тоқтату: ағымдағы орындалуды дереу үзеді. */
  async stop() {
    this._setStatus("loading");
    await this._restart();
    this._setStatus("ready");
  }
}

export const pyRunner = new PyRunner();
