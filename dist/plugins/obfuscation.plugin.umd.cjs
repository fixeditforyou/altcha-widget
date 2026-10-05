(function(factory) {
  typeof define === "function" && define.amd ? define(factory) : factory();
})((function() {
  "use strict";
  const noop = () => {
  };
  function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || a !== null && typeof a === "object" || typeof a === "function";
  }
  function subscribe_to_store(store2, run, invalidate) {
    if (store2 == null) {
      run(void 0);
      return noop;
    }
    const unsub = untrack(
      () => store2.subscribe(
        run,
        // @ts-expect-error
        invalidate
      )
    );
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
  }
  const subscriber_queue = [];
  function writable(value, start = noop) {
    let stop = null;
    const subscribers = /* @__PURE__ */ new Set();
    function set(new_value) {
      if (safe_not_equal(value, new_value)) {
        value = new_value;
        if (stop) {
          const run_queue = !subscriber_queue.length;
          for (const subscriber of subscribers) {
            subscriber[1]();
            subscriber_queue.push(subscriber, value);
          }
          if (run_queue) {
            for (let i = 0; i < subscriber_queue.length; i += 2) {
              subscriber_queue[i][0](subscriber_queue[i + 1]);
            }
            subscriber_queue.length = 0;
          }
        }
      }
    }
    function update(fn) {
      set(fn(
        /** @type {T} */
        value
      ));
    }
    function subscribe(run, invalidate = noop) {
      const subscriber = [run, invalidate];
      subscribers.add(subscriber);
      if (subscribers.size === 1) {
        stop = start(set, update) || noop;
      }
      run(
        /** @type {T} */
        value
      );
      return () => {
        subscribers.delete(subscriber);
        if (subscribers.size === 0 && stop) {
          stop();
          stop = null;
        }
      };
    }
    return { set, update, subscribe };
  }
  function get(store2) {
    let value;
    subscribe_to_store(store2, (_) => value = _)();
    return value;
  }
  let untracking = false;
  function untrack(fn) {
    var previous_untracking = untracking;
    try {
      untracking = true;
      return fn();
    } finally {
      untracking = previous_untracking;
    }
  }
  function store(defaultValue) {
    const scope = {
      get: (name) => {
        return get(scope.store)[name];
      },
      set: (name, value) => {
        if (typeof name === "string") {
          Object.assign(get(scope.store), {
            [name]: value
          });
        } else {
          Object.assign(get(scope.store), name);
        }
        scope.store.set(get(scope.store));
      },
      store: writable(defaultValue)
    };
    return scope;
  }
  globalThis.$altcha = globalThis.$altcha || {
    algorithms: /* @__PURE__ */ new Map(),
    defaults: store({}),
    i18n: store({}),
    instances: /* @__PURE__ */ new Set(),
    plugins: /* @__PURE__ */ new Set()
  };
  class BasePlugin {
    constructor(host) {
      this.host = host;
    }
    host;
    static register(pluginClass) {
      if ("$altcha" in globalThis && !globalThis.$altcha.plugins.has(pluginClass)) {
        globalThis.$altcha.plugins.add(pluginClass);
      }
    }
    async onFetchChallenge(source) {
    }
    async onRequestServerVerification(payload, code) {
    }
    async onVerify(value) {
    }
  }
  function assertAlgorithm(algorithm, allowed) {
    if (!allowed.includes(algorithm)) {
      throw new Error(
        `Unsupported algorithm: ${String(algorithm)}. Expected one of: ${allowed.join(", ")}.`
      );
    }
  }
  function assertPositiveInteger(name, value) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive integer. Got: ${String(value)}`);
    }
  }
  function bufferStartsWith(buffer, prefix) {
    if (prefix.length > buffer.length) {
      return false;
    }
    for (let i = 0; i < prefix.length; i++) {
      if (buffer[i] !== prefix[i]) {
        return false;
      }
    }
    return true;
  }
  function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function concatBuffers(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }
  function hexToBuffer(hex) {
    if (hex.length % 2 !== 0) {
      throw new Error(`Hex string must have an even length. Got: ${hex}`);
    }
    if (!/^[0-9a-fA-F]*$/.test(hex)) {
      throw new Error("Hex string contains non-hex characters.");
    }
    const buffer = new Uint8Array(hex.length / 2);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return buffer;
  }
  async function delay(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  function timeDuration(start) {
    return Math.floor((performance.now() - start) * 10) / 10;
  }
  async function deriveKey(parameters, salt, password) {
    const { algorithm, cost, keyLength = 32 } = parameters;
    assertAlgorithm(algorithm, ["PBKDF2/SHA-256", "PBKDF2/SHA-384", "PBKDF2/SHA-512"]);
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      password,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: cost,
        hash: algorithm.slice("PBKDF2/".length)
      },
      passwordKey,
      keyLength * 8
    );
    return {
      parameters: {},
      derivedKey: new Uint8Array(derivedBits)
    };
  }
  var HmacAlgorithm = /* @__PURE__ */ ((HmacAlgorithm2) => {
    HmacAlgorithm2["SHA_256"] = "SHA-256";
    HmacAlgorithm2["SHA_384"] = "SHA-384";
    HmacAlgorithm2["SHA_512"] = "SHA-512";
    return HmacAlgorithm2;
  })(HmacAlgorithm || {});
  var State = /* @__PURE__ */ ((State2) => {
    State2["CODE"] = "code";
    State2["ERROR"] = "error";
    State2["VERIFIED"] = "verified";
    State2["VERIFYING"] = "verifying";
    State2["UNVERIFIED"] = "unverified";
    State2["EXPIRED"] = "expired";
    return State2;
  })(State || {});
  Object.values(HmacAlgorithm);
  const MAX_COUNTER = {
    string: Number.MAX_SAFE_INTEGER,
    uint32: 4294967295
  };
  function isValidCounter(n, mode) {
    return Number.isInteger(n) && n >= 0 && n <= MAX_COUNTER[mode];
  }
  class PasswordBuffer {
    constructor(nonce, mode = "uint32") {
      this.nonce = nonce;
      this.mode = mode;
      this.buffer = new Uint8Array(this.nonce.length + this.COUNTER_BYTES);
      this.buffer.set(this.nonce, 0);
      this.dataView = new DataView(this.buffer.buffer);
    }
    nonce;
    mode;
    COUNTER_BYTES = 4;
    buffer;
    dataView;
    encoder = new TextEncoder();
    /**
     * Appends the counter to the nonce buffer.
     * In 'string' mode, encodes the counter as a UTF-8 string.
     * In 'uint32' mode, writes the counter as a big-endian 32-bit integer.
     * Throws a RangeError unless the counter is an integer the mode encodes exactly.
     */
    setCounter(n) {
      if (!isValidCounter(n, this.mode)) {
        throw new RangeError(
          `counter must be an integer from 0 to ${MAX_COUNTER[this.mode]}. Got: ${n}`
        );
      }
      if (this.mode === "string") {
        return concatBuffers(this.nonce, this.encoder.encode(n.toString()));
      }
      this.dataView.setUint32(this.nonce.length, n, false);
      return this.buffer;
    }
  }
  async function deriveChallenge(options) {
    const {
      algorithm,
      counter,
      counterMode = "uint32",
      cost,
      deriveKey: deriveKey2,
      data,
      expiresAt,
      keyLength = 32,
      keyPrefix = "00",
      keyPrefixLength = Math.floor(keyLength / 2),
      memoryCost,
      parallelism
    } = options;
    assertPositiveInteger("cost", cost);
    assertPositiveInteger("keyLength", keyLength);
    if (memoryCost !== void 0) {
      assertPositiveInteger("memoryCost", memoryCost);
    }
    if (parallelism !== void 0) {
      assertPositiveInteger("parallelism", parallelism);
    }
    if (counterMode !== "uint32" && counterMode !== "string") {
      throw new Error(`counterMode must be 'uint32' or 'string'. Got: ${String(counterMode)}`);
    }
    const expiresAtSeconds = expiresAt instanceof Date ? Math.floor(expiresAt.getTime() / 1e3) : expiresAt;
    if (expiresAtSeconds !== void 0 && !(Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0)) {
      throw new Error("expiresAt must be a valid Date or a positive number of seconds.");
    }
    const parameters = {
      algorithm,
      nonce: bufferToHex(crypto.getRandomValues(new Uint8Array(16))),
      salt: bufferToHex(crypto.getRandomValues(new Uint8Array(16))),
      cost,
      keyLength,
      memoryCost,
      parallelism,
      keyPrefix,
      expiresAt: expiresAtSeconds,
      data
    };
    if (counter === void 0) {
      assertKeyPrefix(keyPrefix, keyLength);
      parameters.keyPrefix = keyPrefix.toLowerCase();
      return { parameters, derivedKey: null };
    }
    if (!Number.isInteger(keyPrefixLength) || keyPrefixLength < 1) {
      throw new Error(
        `keyPrefixLength must be a positive integer. Got: ${keyPrefixLength} (keyLength: ${keyLength}).`
      );
    }
    const deriveKeyResult = await deriveKey2(
      parameters,
      hexToBuffer(parameters.salt),
      new PasswordBuffer(hexToBuffer(parameters.nonce), counterMode).setCounter(counter)
    );
    if (deriveKeyResult.parameters) {
      Object.assign(parameters, deriveKeyResult.parameters);
    }
    const { derivedKey } = deriveKeyResult;
    if (keyPrefixLength >= derivedKey.length) {
      throw new Error(
        `keyPrefixLength (${keyPrefixLength}) must be less than the derived key length (${derivedKey.length} bytes).`
      );
    }
    parameters.keyPrefix = bufferToHex(
      derivedKey.slice(0, Math.min(keyPrefixLength, Math.floor(derivedKey.length / 2)))
    );
    return { parameters, derivedKey };
  }
  function assertKeyPrefix(keyPrefix, keyLength) {
    if (typeof keyPrefix !== "string" || !/^[0-9a-fA-F]+$/.test(keyPrefix)) {
      throw new Error("keyPrefix must be a non-empty hex string.");
    }
    if (keyPrefix.length > keyLength * 2) {
      throw new Error(
        `keyPrefix (${keyPrefix.length} hex characters) must not be longer than the key (keyLength: ${keyLength} bytes).`
      );
    }
  }
  async function solveChallenge(options) {
    const {
      challenge,
      controller,
      counterMode = "uint32",
      counterStart = 0,
      counterStep = 1,
      deriveKey: deriveKey2,
      timeout = 9e4
    } = options;
    const { nonce, keyLength = 32, keyPrefix, salt } = challenge.parameters;
    assertKeyPrefix(keyPrefix, keyLength);
    const nonceBuf = hexToBuffer(nonce);
    const saltBuf = hexToBuffer(salt);
    const keyPrefixHex = keyPrefix.toLowerCase();
    const keyPrefixBuf = keyPrefix.length % 2 === 0 ? hexToBuffer(keyPrefix) : null;
    const password = new PasswordBuffer(nonceBuf, counterMode);
    const start = performance.now();
    let counter = counterStart;
    let iterations = 0;
    let derivedKeyHex = "";
    let lastYield = start;
    while (true) {
      if (controller?.signal.aborted || timeout && iterations % 10 === 0 && performance.now() - start > timeout) {
        return null;
      }
      const { derivedKey } = await deriveKey2(
        challenge.parameters,
        saltBuf,
        password.setCounter(counter)
      );
      if (iterations % 10 === 0 && performance.now() - lastYield > 200) {
        await delay(0);
        lastYield = performance.now();
      }
      if (keyPrefixBuf ? bufferStartsWith(derivedKey, keyPrefixBuf) : bufferToHex(derivedKey).startsWith(keyPrefixHex)) {
        derivedKeyHex = bufferToHex(derivedKey);
        break;
      }
      counter = counter + counterStep;
      iterations = iterations + 1;
    }
    return {
      counter,
      derivedKey: derivedKeyHex,
      time: timeDuration(start)
    };
  }
  async function solveChallengeWorkers(options) {
    const {
      challenge,
      concurrency = navigator.hardwareConcurrency,
      controller = new AbortController(),
      createWorker,
      onOutOfMemory = (c) => c > 1 ? Math.floor(c / 2) : 0,
      counterMode,
      timeout
    } = options;
    const workersConcurrency = Math.min(16, Math.max(1, concurrency));
    const workersInstances = [];
    const terminate = () => {
      for (const worker of workersInstances) {
        worker.terminate();
      }
    };
    for (let i = 0; i < workersConcurrency; i++) {
      workersInstances.push(await createWorker(challenge.parameters.algorithm));
    }
    let solution = null;
    try {
      solution = await Promise.race(
        workersInstances.map((worker, i) => {
          controller.signal.addEventListener("abort", () => {
            worker.postMessage({ type: "abort" });
          });
          return new Promise((resolve, reject) => {
            worker.addEventListener("error", (err) => {
              reject(err);
            });
            worker.addEventListener("message", (message) => {
              if (message.data) {
                for (const w of workersInstances) {
                  if (w !== worker) {
                    w.postMessage({ type: "abort" });
                  }
                }
                if (message.data.error) {
                  return reject(new Error(message.data.error));
                }
              }
              resolve(message.data);
            });
            worker.postMessage({
              challenge,
              counterMode,
              counterStart: i,
              counterStep: workersConcurrency,
              timeout,
              type: "work"
            });
          });
        })
      );
    } catch (err) {
      const isOOM = err instanceof Error && !!err?.message?.includes("Out of memory");
      if (isOOM) {
        if (onOutOfMemory) {
          terminate();
          const retryConcurrency = onOutOfMemory(workersConcurrency);
          if (retryConcurrency) {
            return solveChallengeWorkers({
              ...options,
              challenge,
              controller,
              concurrency: retryConcurrency,
              createWorker
            });
          }
        }
      }
      throw err;
    } finally {
      terminate();
    }
    if (controller.signal.aborted) {
      return null;
    }
    return solution || null;
  }
  async function deobfuscate(obfuscatedData, options = {}) {
    let {
      concurrency = Math.max(1, Math.min(4, navigator.hardwareConcurrency)),
      createWorker,
      deriveKey: deriveKey$1 = deriveKey
    } = options;
    let challenge = null;
    try {
      challenge = JSON.parse(atob(obfuscatedData));
    } catch {
      throw new Error(`Unable to parse obfuscated data.`);
    }
    if (!challenge || typeof challenge !== "object" || !("parameters" in challenge) || !("cipher" in challenge)) {
      throw new Error(`Invalid obfuscated data format.`);
    }
    const cipher = challenge.cipher;
    let solution = null;
    if (!createWorker && "$altcha" in globalThis) {
      createWorker = globalThis.$altcha.algorithms.get(challenge.parameters.algorithm);
    }
    if (createWorker) {
      solution = await solveChallengeWorkers({
        challenge,
        concurrency,
        createWorker
      });
    } else {
      solution = await solveChallenge({
        challenge,
        deriveKey: deriveKey$1
      });
    }
    if (!solution) {
      throw new Error("Unable to find solution.");
    }
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBuffer(solution.derivedKey),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const result = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: hexToBuffer(cipher.iv)
      },
      key,
      hexToBuffer(cipher.data)
    );
    return new TextDecoder().decode(result);
  }
  async function obfuscate(str, options = {}) {
    const { deriveKey: deriveKey$1 = deriveKey } = options;
    const counterMin = options?.counterMin || 20;
    const counterMax = options?.counterMax || 200;
    const { parameters, derivedKey } = await deriveChallenge({
      algorithm: "PBKDF2/SHA-256",
      cost: 5e3,
      deriveKey: deriveKey$1,
      counter: Math.floor(Math.random() * (counterMax - counterMin + 1)) + counterMin,
      ...options
    });
    if (!derivedKey) {
      throw new Error("A counter is required to obfuscate data.");
    }
    const key = await crypto.subtle.importKey(
      "raw",
      derivedKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(str)
    );
    return btoa(
      JSON.stringify({
        parameters,
        cipher: {
          iv: bufferToHex(iv),
          data: bufferToHex(data)
        }
      })
    );
  }
  class ObfuscationPlugin extends BasePlugin {
    static deobfuscate = deobfuscate;
    static obfuscate = obfuscate;
    elTrigger = null;
    activate() {
      this.elTrigger = this.host.querySelector("button");
      if (this.elTrigger) {
        this.elTrigger.addEventListener("click", this.onTriggerClick.bind(this));
        this.host.configure({
          floatingAnchor: this.elTrigger
        });
      }
    }
    destroy() {
    }
    async onVerify(options) {
      const { minDuration = 500 } = options;
      const start = performance.now();
      const obfuscated = this.host.getAttribute("data-obfuscated");
      if (obfuscated) {
        this.host.reset(State.VERIFYING);
        try {
          const text = await deobfuscate(obfuscated);
          await this.#wait(Math.max(0, minDuration - (performance.now() - start)));
          this.#renderClearText(text);
        } catch (err) {
          this.host.setState(State.ERROR, String(err));
        } finally {
          this.host.setState(State.VERIFIED);
        }
        return null;
      }
    }
    onTriggerClick(ev) {
      ev.preventDefault();
      this.host.show();
      this.host.verify().then(() => {
        this.host.hide();
      });
    }
    #renderClearText(clearText) {
      const match = clearText.match(/^(mailto|tel|sms|https?):/);
      let el;
      if (match) {
        const [contact] = clearText.slice(clearText.indexOf(":") + 1).replace(/^\/\//, "").split("?");
        el = document.createElement("a");
        el.href = clearText;
        el.innerText = contact;
      } else {
        el = document.createTextNode(clearText);
      }
      if (this.elTrigger && el) {
        this.elTrigger.after(el);
        this.elTrigger.parentElement?.removeChild(this.elTrigger);
      }
    }
    async #wait(ms) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }
  BasePlugin.register(ObfuscationPlugin);
}));
