/* global suite suiteSetup test */
'use strict'

const { assert } = require('chai')

const {
  apply,
  isApplicationOf,
  wrap,
  unwrap,
  hasMixin,
  BareMixin,
  Mixin,
  DeDupe,
  HasInstance,
  mix,
  mixins
} = require('../mixwith')

suite('mixwith.js', () => {
  suite('apply() and isApplicationOf()', () => {
    test('apply() applies a mixin function', () => {
      const M = (s) => class extends s {
        test () {
          return true
        }
      }

      class Test extends apply(Object, M) {}

      const i = new Test()
      assert.isTrue(i.test())
    })

    test('isApplication() returns true for a mixin applied by apply()', () => {
      const M = (s) => class extends s {}
      assert.isTrue(isApplicationOf(apply(Object, M).prototype, M))
    })

    test('isApplication() works with wrapped mixins', () => {
      const M = (s) => class extends s {}
      const WrappedM = wrap(M, (superclass) => apply(superclass, M))
      assert.isTrue(isApplicationOf(WrappedM(Object).prototype, WrappedM))
    })

    test('isApplication() returns false when it should', () => {
      const M = (s) => class extends s {}
      const X = (s) => class extends s {}
      assert.isFalse(isApplicationOf(apply(Object, M).prototype, X))
    })
  })

  suite('hasMixin()', () => {
    test('hasMixin() returns true for a mixin applied by apply()', () => {
      const M = (s) => class extends s {}

      assert.isTrue(hasMixin(apply(Object, M).prototype, M))
    })
  })

  suite('wrap() and unwrap()', () => {
    test('wrap() sets the prototype', () => {
      const f = (x) => x * x
      f.test = true
      const wrapper = (x) => f(x)
      wrap(f, wrapper)
      assert.isTrue(wrapper.test)
      assert.equal(f, Object.getPrototypeOf(wrapper))
    })

    test('unwrap() returns the wrapped function', () => {
      const f = (x) => x * x
      const wrapper = (x) => f(x)
      wrap(f, wrapper)
      assert.equal(f, unwrap(wrapper))
    })
  })

  suite('BareMixin', () => {
    test('mixin application is on prototype chain', () => {
      const M = BareMixin((s) => class extends s {})

      class C extends M(Object) {}

      const i = new C()
      assert.isTrue(hasMixin(i, M))
    })

    test('methods on mixin are present', () => {
      const M = BareMixin((s) => class extends s {
        foo () { return 'foo' }
      })

      class C extends M(Object) {}

      const i = new C()
      assert.deepEqual(i.foo(), 'foo')
    })

    test('methods on superclass are present', () => {
      const M = BareMixin((s) => class extends s {})

      class S {
        foo () { return 'foo' }
      }

      class C extends M(S) {}

      const i = new C()
      assert.deepEqual(i.foo(), 'foo')
    })

    test('methods on subclass are present', () => {
      const M = BareMixin((s) => class extends s {})

      class C extends M(Object) {
        foo () { return 'foo' }
      }

      const i = new C()
      assert.deepEqual(i.foo(), 'foo')
    })

    test('methods on mixin override superclass', () => {
      const M = BareMixin((s) => class extends s {
        foo () { return 'bar' }
      })

      class S {
        foo () { return 'foo' }
      }

      class C extends M(S) {}

      const i = new C()
      assert.deepEqual(i.foo(), 'bar')
    })

    test('methods on mixin can call super', () => {
      const M = BareMixin((s) => class extends s {
        foo () { return super.foo() }
      })

      class S {
        foo () { return 'superfoo' }
      }

      class C extends M(S) {}

      const i = new C()
      assert.deepEqual(i.foo(), 'superfoo')
    })

    test('methods on subclass override superclass', () => {
      const M = BareMixin((s) => class extends s {})

      class S {
        foo () { return 'superfoo' }
      }

      class C extends M(S) {
        foo () { return 'subfoo' }
      }

      const i = new C()
      assert.deepEqual(i.foo(), 'subfoo')
    })

    test('methods on subclass override mixin', () => {
      const M = BareMixin((s) => class extends s {
        foo () { return 'mixinfoo' }
      })

      class S {}

      class C extends M(S) {
        foo () { return 'subfoo' }
      }

      const i = new C()
      assert.deepEqual(i.foo(), 'subfoo')
    })

    test('methods on subclass can call super to superclass', () => {
      const M = BareMixin((s) => class extends s {})

      class S {
        foo () { return 'superfoo' }
      }

      class C extends M(S) {
        foo () { return super.foo() }
      }

      const i = new C()
      assert.deepEqual(i.foo(), 'superfoo')
    })
  })

  suite('DeDupe', () => {
    test('applies the mixin the first time', () => {
      const M = DeDupe(BareMixin((superclass) => class extends superclass {}))

      class C extends M(Object) {}

      const i = new C()
      assert.isTrue(hasMixin(i, M))
    })

    test('does\'n apply the mixin the second time', () => {
      let applicationCount = 0
      const M = DeDupe(BareMixin((superclass) => {
        applicationCount++
        return class extends superclass {}
      }))

      class C extends M(M(Object)) {}

      const i = new C()
      assert.isTrue(hasMixin(i, M))
      assert.equal(1, applicationCount)
    })
  })

  suite('HasInstance', () => {
    let hasNativeHasInstance = false

    suiteSetup(() => {
      // Enable the @@hasInstance patch in mixwith.HasInstance
      if (!Symbol.hasInstance) {
        Symbol.hasInstance = Symbol('hasInstance')
      }

      class Check {
        static [Symbol.hasInstance] (o) { return true }
      }

      hasNativeHasInstance = 1 instanceof Check
    })

    test('subclasses implement mixins', () => {
      const M = HasInstance((s) => class extends s {})

      class C extends M(Object) {}

      const i = new C()

      if (hasNativeHasInstance) {
        assert.instanceOf(i, C)
      } else {
        assert.isTrue(C[Symbol.hasInstance](i))
      }
    })
  })

  const nthPrototypeOf = (it, n) => {
    if (n < 1) throw new Error('n must be >= 1')
    const proto = Object.getPrototypeOf(it)
    return n === 1 ? proto : nthPrototypeOf(proto, n - 1)
  }

  suite('mix().with()', () => {
    test('applies mixins in order with superclass', () => {
      const M1 = BareMixin((s) => class extends s {})
      const M2 = BareMixin((t) => class extends t {})

      class S {}

      class C extends mix(S).with(M1, M2) {}

      const i = new C()
      assert.isTrue(hasMixin(i, M1))
      assert.isTrue(hasMixin(i, M2))
      assert.isTrue(isApplicationOf(nthPrototypeOf(i, 2), M2))
      assert.isTrue(isApplicationOf(nthPrototypeOf(i, 3), M1))
      assert.equal(nthPrototypeOf(i, 4), S.prototype)
    })

    test('applies mixins in order with Object as superclass', () => {
      const M1 = BareMixin((s) => class extends s {})
      const M2 = BareMixin((s) => class extends s {})

      class C extends mix(Object).with(M1, M2) {}

      const i = new C()
      assert.isTrue(hasMixin(i, M1))
      assert.isTrue(hasMixin(i, M2))
      assert.isTrue(isApplicationOf(nthPrototypeOf(i, 2), M2))
      assert.isTrue(isApplicationOf(nthPrototypeOf(i, 3), M1))
      assert.equal(nthPrototypeOf(i, 4), Object.prototype)
    })

    test('mix() can omit the superclass', () => {
      const M = BareMixin((s) => class extends s {
        static staticMixinMethod () {
          return 42
        }

        foo () {
          return 'foo'
        }

        snafu () {
          return 'M.snafu'
        }
      })

      class C extends mix().with(M) {
        static staticClassMethod () {
          return 7
        }

        bar () {
          return 'bar'
        }

        snafu () {
          return 'C.snafu'
        }
      }

      let i = new C()
      assert.isTrue(hasMixin(i, M), 'hasMixin')
      assert.isTrue(isApplicationOf(nthPrototypeOf(i, 2), M), 'isApplicationOf')
      assert.equal('foo', i.foo())
      assert.equal('bar', i.bar())
      assert.equal('C.snafu', i.snafu())
      assert.equal(42, C.staticMixinMethod())
      assert.equal(7, C.staticClassMethod())
    })
  })

  suite('basic usage', () => {
    test('class instanceof mixin', () => {
      const M = Mixin(c => class extends c {})
      const N = Mixin(d => class extends d {})

      class C extends mixins(M, N) {}

      const c = new C()
      assert.isTrue(c instanceof C)
      assert.isTrue(hasMixin(c, M))
      assert.isTrue(hasMixin(c, N))
      assert.isTrue(c instanceof M)
      assert.isTrue(c instanceof N)
    })
  })
})
