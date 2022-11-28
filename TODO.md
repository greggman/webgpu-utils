# To Do

- [ ] handle without views via index
- [ ] make defs smaller (don't expand arrays)
- [ ] handle sub setting `set('foo.bar', value);

- [ ] check makeStructuredView.set doesn't conflict with field named `'set'`

## Done

- [X] Uniform and Storage defs should be different than Structure defs

  Just that they have binding and group

- [X] handle without views
- [X] handle storage buffers
- [X] make defs for name (instead of all)

  No, input is the shader source. It's seems an over optimization
  to pass in a single name and then have to parse again to get a different
  name.
