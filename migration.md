# Migration Notes

## 0.x -> 1.x

* primitive functions changed to named parameters

  * old: `createSphereVertices(2, 12)`
  * new: `createSphereVertices({radius = 2, subdivisionsAxis = 12})`

  This means you only have to specify what you change where as with
  the previous style you had to specify everything up to the parameter
  you actually wanted to change.
