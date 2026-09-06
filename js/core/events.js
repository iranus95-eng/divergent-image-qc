/* Divergent V3 - small application event bus */
(function (window) {
  'use strict';

  const TARGET = new EventTarget();

  function on(name, handler) {
    if (!name || typeof handler !== 'function') return function () {};
    TARGET.addEventListener(name, handler);
    return function unsubscribe() {
      TARGET.removeEventListener(name, handler);
    };
  }

  function once(name, handler) {
    if (!name || typeof handler !== 'function') return function () {};
    const wrapped = function (event) {
      TARGET.removeEventListener(name, wrapped);
      handler(event);
    };
    TARGET.addEventListener(name, wrapped);
    return function unsubscribe() {
      TARGET.removeEventListener(name, wrapped);
    };
  }

  function emit(name, detail) {
    if (!name) return;
    TARGET.dispatchEvent(new CustomEvent(name, { detail }));
  }

  window.DivergentEvents = Object.freeze({ on, once, emit });
})(window);
