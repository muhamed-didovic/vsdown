const ora = require('ora')

/**
 * @param {import('ora').Options & {disabled: boolean}} opts
 * @returns {import('ora').Ora}
 */
module.exports = (opts = {}) => new Proxy({ isLogger: true }, {
  get (target, prop) {
    if (hasOwn(target, prop)) return Reflect.get(target, prop)
    if (opts.disabled) return returnNullObj
    const o = ora(opts)
    if (prop === 'promise') {
      return (p, text) => {
        const spin = o.start(text)
        return p.then(
          v => (spin.succeed(text + '  completed.'), v),
          err => (spin.fail(text + '  failed!'), Promise.reject(err))
        )
      }
    }
    return typeof o[prop] === 'function' ? o[prop].bind(o) : o[prop]
  }
})

function hasOwn (o, prop) {
  return Object.prototype.hasOwnProperty.call(o, prop)
}

function returnNullObj () {
  return {}
}
