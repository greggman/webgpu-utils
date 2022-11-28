# To Do

- [ ] handle without views
- [ ] handle without views via index
- [ ] make defs smaller (don't expand arrays)
- [ ] handle storage buffers
- [X] make defs for name (instead of all)
- [ ] Uniform and Storage defs should be different than Structure defs

  No, input is the shader source. It's seems an over optimization
  to pass in a single name and then have to parse again to get a different
  name.

- [ ] check makeStructuredView.set doesn't conflict with field named `'set'`
