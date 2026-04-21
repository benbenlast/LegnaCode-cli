/**
 * Generic utility types used across the codebase.
 */

export type DeepImmutable<T> =
  T extends Map<infer K, infer V> ? ReadonlyMap<DeepImmutable<K>, DeepImmutable<V>> :
  T extends Set<infer S> ? ReadonlySet<DeepImmutable<S>> :
  T extends ReadonlyArray<infer E> ? readonly DeepImmutable<E>[] :
  T extends object ? { readonly [K in keyof T]: DeepImmutable<T[K]> } :
  T

export type Permutations<T extends string, U extends string = T> =
  [T] extends [never]
    ? []
    : T extends T
      ? [T, ...Permutations<Exclude<U, T>>]
      : never
