const fp = require('lodash/fp');
const { emitter, bind } = require('./util');
const { observe } = require('./transforms');

function listen(eventName, em = emitter()) {
  return (el, onRelease = fp.noop) => {
    em.bind((emit, error, complete) => {
      error = null;
      onRelease(() => {
        em = null;
        complete();
      });
      el.addEventListener(eventName, function listener(evt) {
        emit(evt, () => em.removeListener(eventName, listener));
      });
    });
    return em;
  };
}

function bindel(field, eventName, em) {
  return (el, onRemoved = fp.noop) => {
    onRemoved(() => { el = null; });
    bind(
      observe(
        () => (el ? el[field] : null),
        listen(eventName)(el, onRemoved)),
      em);
  };
}

module.exports = {
  bindel,
  listen,
};
