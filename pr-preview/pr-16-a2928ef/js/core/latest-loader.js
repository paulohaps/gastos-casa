(function (root) {
  "use strict";

  function create({ read, publish, isEmpty }) {
    let generation = 0,
      active;
    async function load(key) {
      active?.abort();
      active = new AbortController();
      const controller = active,
        turn = ++generation;
      publish({ status: "loading", key, data: null });
      try {
        const data = await read(key, controller.signal);
        if (turn !== generation || controller.signal.aborted) return;
        publish({ status: isEmpty(data) ? "empty" : "success", key, data });
        return data;
      } catch (error) {
        if (turn !== generation || controller.signal.aborted) return;
        publish({ status: "error", key, data: null, error });
      }
    }
    return Object.freeze({ load });
  }
  root.GastosLatestLoader = Object.freeze({ create });
})(globalThis);
