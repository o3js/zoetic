const fp = require('lodash/fp');
const { emitter, bind } = require('./util');
const { observe } = require('./transforms');

function listen(eventName, em = emitter()) {
  return (el, onRelease = fp.noop) => {
    em.bind((emit, error, complete, opts) => {
      error = null;
      onRelease(() => {
        em = null;
        complete();
      });
      let halted = false;
      opts.onHalt(() => {
        el.removeEventListener(eventName, emit);
        halted = true;
      });

      if (!halted) el.addEventListener(eventName, emit);
    });
    return em;
  };
}

function bindel(field, eventName, em) {
  return (el, onRelease = fp.noop) => {
    onRelease(() => { el = null; });
    bind(
      observe(
        () => (el ? el[field] : null),
        listen(eventName)(el, onRelease)),
      em);
  };
}

module.exports = {
  bindel,
  listen,
};
