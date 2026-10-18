(function (root) {
  "use strict";
  // Share pending loads, but never retain a failed promise or script element.
  function create(document, globals, timeoutMs = 30000) {
    const pending = new Map();
    function load(src, globalName) {
      if (globals[globalName]) return Promise.resolve(globals[globalName]);
      if (pending.has(globalName)) return pending.get(globalName);
      const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const timer = setTimeout(
          () =>
            finish(
              new Error("A leitura demorou para carregar. Tente novamente."),
            ),
          timeoutMs,
        );
        function finish(error) {
          clearTimeout(timer);
          script.onload = script.onerror = null;
          if (error) {
            script.remove();
            reject(error);
          } else resolve(globals[globalName]);
        }
        script.src = src;
        script.async = true;
        script.onload = () =>
          finish(
            globals[globalName]
              ? null
              : new Error("Recurso de leitura indisponível. Tente novamente."),
          );
        script.onerror = () =>
          finish(
            new Error("Falha ao carregar recurso de leitura. Tente novamente."),
          );
        document.head.appendChild(script);
      }).finally(() => pending.delete(globalName));
      pending.set(globalName, promise);
      return promise;
    }
    return Object.freeze({ load });
  }
  root.GastosScriptLoader = Object.freeze({ create });
})(globalThis);
