# To Do

- [ ] handle without views via index
- [ ] make defs smaller (don't expand arrays)
- [ ] add group/binding map
- [ ] check makeStructuredView.set doesn't conflict with field named `'set'`
- [ ] allow querying offset and range for manual setting
- [ ] show creating your own spec.

## Done

- [X] handle sub setting `set('foo.bar', value);

  This already works. you can do `set({foo: {bar: value}})`;

- [X] Uniform and Storage defs should be different than Structure defs

  Just that they have binding and group

- [X] handle without views
- [X] handle storage buffers
- [X] make defs for name (instead of all)

  No, input is the shader source. It's seems an over optimization
  to pass in a single name and then have to parse again to get a different
  name.
