---
title: Fixtures and Interceptors
sidebar_label: Fixtures and Interceptors
---

Fixtures and Interceptors allow universal data mocking without the need for monkeypatching
fetch behaviors. Fixtures define static responses to specific endpoint arg combinations. This
allows them to be used in static contexts like [mockInitialState()](./mockInitialState.md).
Interceptors are functions run and match a fetch pattern. This restricts them to being used only
in dynamic response contexts like [MockResolver](./MockResolver.md).

## SuccessFixture

Represents a successful response

```ts
export interface SuccessFixture<
  E extends EndpointInterface = EndpointInterface,
> {
  readonly endpoint: E;
  readonly args: Parameters<E>;
  readonly response:
    | ResolveType<E>
    | ((...args: Parameters<E>) => ResolveType<E>);
  readonly error?: false;
  /** Number of miliseconds to wait before resolving */
  readonly delay?: number;
}
```

```ts
const countFixture = {
  endpoint: new RestEndpoint({ path: '/api/count' }),
  args: [],
  response: { count: 0 },
};
```

## ErrorFixtures

Represents a failed/errored response

```ts
export interface ErrorFixture<E extends EndpointInterface = EndpointInterface> {
  readonly endpoint: E;
  readonly args: Parameters<E>;
  readonly response: any;
  readonly error: true;
  /** Number of miliseconds to wait before resolving */
  readonly delay?: number;
}
```

```ts
const countErrorFixture = {
  endpoint: new RestEndpoint({ path: '/api/count' }),
  args: [],
  response: { message: 'Not found', status: 404 },
  error: true,
};
```

## Interceptor

Interceptors will match a request based on its [`testKey()`](/rest/api/RestEndpoint#testKey) method, then
compute the response dynamically using the `response()` method.

```ts
export interface Interceptor<
  T = any,
  E extends EndpointInterface & {
    update?: Updater;
    testKey(key: string): boolean;
  } = EndpointInterface & { testKey(key: string): boolean },
> {
  readonly endpoint: E;
  response(this: T, ...args: Parameters<E>): ResolveType<E>;
  /** Number of miliseconds (or function that returns) to wait before resolving */
  readonly delay?: number | ((...args: Parameters<E>) => number);
  /** Waits to run `response()` after `delay` time */
  readonly delayCollapse?: boolean;
}
```

```ts
const incrementInterceptor = {
  endpoint: new RestEndpoint({
    path: '/api/count/increment',
    method: 'POST',
    body: undefined,
  }),
  response() {
    return {
      count: (this.count = this.count + 1),
    };
  },
  delay: () => 500 + Math.random() * 4500,
};
```

## Arguments

### endpoint

The endpoint to match.

### args

(Fixtures only) The args to match.

### response

Determines what the response for this mock should be. If a function it will be run.

Function running is called 'collapsing' after the mechanism in [Quantum Mechanics](https://www.wondriumdaily.com/copenhagen-interpretation-of-quantum-mechanics/)

`this` can be used to store simulated server-side data. It is initialized using [getInitialInterceptorData](./MockResolver.md#getinitialinterceptordata). It's important to not use arrow functions when using this as they disallow `this` binding.

### delay

This is the number of miliseconds to wait before resolving the promise. This can be useful
when simulating race conditions.

When a function is sent, its return value is used as the number of miliseconds.

### delayCollapse: boolean {#delayCollapse}

`true`: Runs response() after [delay](#delay) time

`false`: Runs response() immediately, then resolves it after [delay](#delay) time

This can be useful for simulating server-processing delays.
