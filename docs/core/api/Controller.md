---
title: Controller
---

<head>
  <title>Controller - Imperative Controls for Rest Hooks</title>
  <meta name="docsearch:pagerank" content="30"/>
</head>

import LanguageTabs from '@site/src/components/LanguageTabs';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

```ts
class Controller {
  /*************** Action Dispatchers ***************/
  fetch(endpoint, ...args): ReturnType<E>;
  invalidate(endpoint, ...args): Promise<void>;
  invalidateAll({ testKey }): Promise<void>;
  resetEntireStore(): Promise<void>;
  setResponse(endpoint, ...args, response): Promise<void>;
  setError(endpoint, ...args, error): Promise<void>;
  resolve(endpoint, { args, response, fetchedAt, error }): Promise<void>;
  subscribe(endpoint, ...args): Promise<void>;
  unsubscribe(endpoint, ...args): Promise<void>;
  /*************** Data Access ***************/
  getResponse(endpoint, ...args, state): { data, expiryStatus, expiresAt };
  getError(endpoint, ...args, state): ErrorTypes | undefined;
  snapshot(state: State<unknown>, fetchedAt?: number): SnapshotInterface;
  getState(): State<unknown>;
}
```

`Controller` is a singleton providing safe access to the Rest Hooks [flux store and lifecycle](./Manager.md#control-flow).

[useController()](./useController.md) provides access in React components, and for [Managers](./Manager.md)
it is passed as the first argument in [Manager.getMiddleware()](./Manager.md#middleware)

## fetch(endpoint, ...args) {#fetch}

Fetches the endpoint with given args, updating the Rest Hooks cache with
the response or error upon completion.

<Tabs
defaultValue="Create"
values={[
{ label: 'Create', value: 'Create' },
{ label: 'Update', value: 'Update' },
{ label: 'Delete', value: 'Delete' },
]}>
<TabItem value="Create">

```tsx
function CreatePost() {
  const ctrl = useController();

  return (
    <form
      onSubmit={e => ctrl.fetch(PostResource.create, new FormData(e.target))}
    >
      {/* ... */}
    </form>
  );
}
```

</TabItem>
<TabItem value="Update">

```tsx
function UpdatePost({ id }: { id: string }) {
  const ctrl = useController();

  return (
    <form
      onSubmit={e =>
        ctrl.fetch(PostResource.update, { id }, new FormData(e.target))
      }
    >
      {/* ... */}
    </form>
  );
}
```

</TabItem>
<TabItem value="Delete">

```tsx
function PostListItem({ post }: { post: PostResource }) {
  const ctrl = useController();

  const handleDelete = useCallback(
    async e => {
      await ctrl.fetch(PostResource.delete, { id: post.id });
      history.push('/');
    },
    [ctrl, id],
  );

  return (
    <div>
      <h3>{post.title}</h3>
      <button onClick={handleDelete}>X</button>
    </div>
  );
}
```

</TabItem>
</Tabs>

:::tip

`fetch` has the same return value as the [Endpoint](/rest/api/Endpoint) passed to it.
When using schemas, the denormalized value can be retrieved using a combination of
[Controller.getResponse](#getResponse) and [Controller.getState](#getState)

```ts
await controller.fetch(PostResource.create, createPayload);
const { data: denormalizedResponse } = controller.getResponse(
  PostResource.create,
  createPayload,
  controller.getState(),
);
```

:::

### Endpoint.sideEffect

[sideEffect](/rest/api/Endpoint#sideeffect) changes the behavior

#### true

- Resolves _before_ committing Rest Hooks cache updates.
- Each call will always cause a new fetch.

#### undefined

- Resolves _after_ committing Rest Hooks cache updates.
- Identical requests are deduplicated globally; allowing only one inflight request at a time.
  - To ensure a _new_ request is started, make sure to abort any existing inflight requests.

## invalidate(endpoint, ...args) {#invalidate}

Forces refetching and suspense on [useSuspense](./useSuspense.md) with the same Endpoint
and parameters.

```tsx
function ArticleName({ id }: { id: string }) {
  const article = useSuspense(ArticleResource.get, { id });
  const ctrl = useController();

  return (
    <div>
      <h1>{article.title}<h1>
      <button onClick={() => ctrl.invalidate(ArticleResource.get, { id })}>Fetch &amp; suspend</button>
    </div>
  );
}
```

:::tip

To refresh while continuing to display stale data - [Controller.fetch](#fetch) instead.

:::

:::tip Invalidate many endpoints at once

Use [schema.Delete](/rest/api/Delete) to invalidate every endpoint that contains a given entity.

:::

## invalidateAll({ testKey }) {#invalidateAll}

[Invalidates](../concepts/expiry-policy#invalid) all [endpoint keys](/rest/api/RestEndpoint#key) matching `testKey`.

```tsx
function ArticleName({ id }: { id: string }) {
  const article = useSuspense(ArticleResource.get, { id });
  const ctrl = useController();

  return (
    <div>
      <h1>{article.title}<h1>
      <button onClick={() => ctrl.invalidateAll(ArticleResource.get)}>Fetch &amp; suspend</button>
    </div>
  );
}
```

Here we clear only GET endpoints using the test.com domain. This means other domains remain in cache.

```tsx
const myDomain = 'http://test.com';

function useLogout() {
  const ctrl = useController();
  const testKey = (key: string) => key.startsWith(`GET ${myDomain}`);
  return () => ctrl.invalidateAll({ testKey });
}
```

## resetEntireStore() {#resetEntireStore}

Resets/clears the entire Rest Hooks cache. All inflight requests will not resolve.

This is typically used when logging out or changing authenticated users.

```tsx
const USER_NUMBER_ONE: string = "1111";

function UserName() {
  const user = useSuspense(CurrentUserResource.get);
  const ctrl = useController();

  const becomeAdmin = useCallback(() => {
    // Changes the current user
    impersonateUser(USER_NUMBER_ONE);
    // highlight-next-line
    ctrl.resetEntireStore();
  }, [ctrl]);
  return (
    <div>
      <h1>{user.name}<h1>
      <button onClick={becomeAdmin}>Be Number One</button>
    </div>
  );
}
```

## receive() {#receive}

Another name for setResponse()

## setResponse(endpoint, ...args, response) {#setResponse}

Stores `response` in cache for given [Endpoint](/rest/api/Endpoint) and args.

Any components suspending for the given [Endpoint](/rest/api/Endpoint) and args will resolve.

If data already exists for the given [Endpoint](/rest/api/Endpoint) and args, it will be updated.

```tsx
const ctrl = useController();

useEffect(() => {
  const websocket = new Websocket(url);

  websocket.onmessage = event =>
    ctrl.setResponse(EndpointLookup[event.endpoint], ...event.args, event.data);

  return () => websocket.close();
});
```

This shows a proof of concept in React; however a [Manager websockets implementation](./Manager.md#data-stream)
would be much more robust.

## receiveError() {#receiveError}

Another name for setError()

## setError(endpoint, ...args, error) {#setError}

Stores the result of [Endpoint](/rest/api/Endpoint) and args as the error provided.

## resolve(endpoint, { args, response, fetchedAt, error }) {#resolve}

Resolves a specific fetch, storing the `response` in cache.

This is similar to setResponse, except it triggers resolution of an inflight fetch.
This means the corresponding optimistic update will no longer be applies.

This is used in [NetworkManager](./NetworkManager.md), and should be used when
processing fetch requests.

## subscribe(endpoint, ...args) {#subscribe}

Marks a new subscription to a given [Endpoint](/rest/api/Endpoint). This should increment the subscription.

[useSubscription](./useSubscription.md) calls this on mount.

This might be useful for custom hooks to sub/unsub based on other factors.

```tsx
const controller = useController();
const key = endpoint.key(...args);

useEffect(() => {
  controller.subscribe(endpoint, ...args);
  return () => controller.unsubscribe(endpoint, ...args);
}, [controller, key]);
```

## unsubscribe(endpoint, ...args) {#unsubscribe}

Marks completion of subscription to a given [Endpoint](/rest/api/Endpoint). This should
decrement the subscription and if the count reaches 0, more updates won't be received automatically.

[useSubscription](./useSubscription.md) calls this on unmount.

## getResponse(endpoint, ...args, state) {#getResponse}

```ts title="returns"
{
  data: DenormalizeNullable<E['schema']>;
  expiryStatus: ExpiryStatus;
  expiresAt: number;
}
```

Gets the (globally referentially stable) response for a given endpoint/args pair from state given.

### data

The denormalize response data. Guarantees global referential stability for all members.

### expiryStatus

```ts
export enum ExpiryStatus {
  Invalid = 1,
  InvalidIfStale,
  Valid,
}
```

#### Valid

- Will never suspend.
- Might fetch if data is stale

#### InvalidIfStale

- Will suspend if data is stale.
- Might fetch if data is stale

#### Invalid

- Will always suspend
- Will always fetch

### expiresAt

A number representing time when it expires. Compare to Date.now().

### Example

This is used in [useCache](./useCache.md), [useSuspense](./useSuspense.md) and can be used in
[Managers](./Manager.md) to lookup a response with the state provided.

```tsx title="useCache.ts"
import {
  useController,
  StateContext,
  EndpointInterface,
} from '@rest-hooks/core';

/** Oversimplified useCache */
function useCache<E extends EntityInterface>(
  endpoint: E,
  ...args: readonly [...Parameters<E>]
) {
  const state = useContext(StateContext);
  const controller = useController();
  return controller.getResponse(endpoint, ...args, state).data;
}
```

```tsx title="MyManager.ts"
import type { Manager, Middleware, actionTypes } from '@rest-hooks/core';
import type { EndpointInterface } from '@rest-hooks/endpoint';

export default class MyManager implements Manager {
  protected declare middleware: Middleware;
  constructor() {
    this.middleware = ({ controller, getState }) => {
      return next => async action => {
        if (action.type === actionTypes.FETCH_TYPE) {
          console.log('The existing response of the requested fetch');
          console.log(
            controller.getResponse(
              action.endpoint,
              ...(action.meta.args as Parameters<typeof action.endpoint>),
              getState(),
            ).data,
          );
        }
        next(action);
      };
    };
  }

  cleanup() {
    this.websocket.close();
  }

  getMiddleware<T extends StreamManager>(this: T) {
    return this.middleware;
  }
}
```

## getError(endpoint, ...args, state) {#getError}

Gets the error, if any, for a given endpoint. Returns undefined for no errors.

## snapshot(state, fetchedAt) {#snapshot}

Returns a [Snapshot](./Snapshot.md).

## getState() {#getState}

Gets the internal state of Rest Hooks that has _already been committed_.

:::warning

This should only be used in event handlers or [Managers](./Manager.md).

Using getState() in React's render lifecycle can result in data tearing.

:::

```tsx
const controller = useController();

const updateHandler = useCallback(
  async updatePayload => {
    const response = await controller.fetch(
      MyResource.update,
      { id },
      updatePayload,
    );
    // the fetch has completed, but react has not yet re-rendered
    // this lets use sequence after the next re-render
    // we're working on a better solution to this specific case
    setTimeout(() => {
      const { data: denormalized } = controller.getResponse(
        MyResource.update,
        { id },
        updatePayload,
        controller.getState(),
      );
      redirect(denormalized.getterUrl);
    }, 40);
  },
  [id],
);
```
