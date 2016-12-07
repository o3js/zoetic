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

function observel(field, eventName, em) {
  return (el, release) => {
    bind(
      observe(
        () => el[field],
        listen(eventName)(el, release)),
      em);
  };
}

module.exports = {
  observel,
  listen,
};
