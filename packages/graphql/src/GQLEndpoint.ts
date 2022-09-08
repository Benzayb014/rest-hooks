import { Endpoint, EndpointOptions } from '@rest-hooks/endpoint';
import type { Schema } from '@rest-hooks/endpoint';

import GQLNetworkError from './GQLNetworkError.js';

export default class GQLEndpoint<
  Variables,
  S extends Schema | undefined = Schema | undefined,
  M extends true | undefined = true | undefined,
> extends Endpoint<(v: Variables) => Promise<any>, S, M> {
  declare url: string;
  declare signal?: AbortSignal;

  constructor(
    url: string,
    options?: EndpointOptions<(v: Variables) => Promise<any>, S, M>,
  ) {
    const args = url ? { ...options, url } : options;
    super(async function (this: GQLEndpoint<Variables, S>, variables: any) {
      return fetch(
        this.url,
        this.getFetchInit({
          body: JSON.stringify({
            query: this.getQuery(variables),
            variables,
          }),
          method: 'POST',
          signal: this.signal ?? null,
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        }),
      )
        .then(async res => {
          const json = await res.json();
          if (json.errors) throw new GQLNetworkError(json.errors);
          if (!res.ok) throw new GQLNetworkError([json]);
          return json.data;
        })
        .catch(error => {
          // ensure CORS, network down, and parse errors are still caught by NetworkErrorBoundary
          if (error instanceof TypeError) {
            (error as any).status = 400;
          }
          throw error;
        });
    }, args);
    return this;
  }

  key(variables: Variables): string {
    // TODO: make this faster
    return `${this.getQuery(variables)} ${JSON.stringify(variables)}`;
  }

  getFetchInit(init: RequestInit): RequestInit {
    return init;
  }

  getQuery(variables: Variables): string {
    throw new Error('You must include a query');
  }

  getHeaders(headers: HeadersInit): HeadersInit {
    return headers;
  }

  errorPolicy(error: any) {
    return error.status >= 500 ? ('soft' as const) : undefined;
  }

  query<
    Q extends string | ((variables: any) => string),
    S extends Schema | undefined,
    E extends GQLEndpoint<any, any> = GQLEndpoint<any, any>,
  >(
    this: E,
    queryOrGetQuery: Q,
    schema?: S,
  ): GQLEndpoint<
    Q extends (variables: infer V) => string ? V : any,
    S,
    undefined
  > {
    const options: any = {
      schema,
      getQuery:
        typeof queryOrGetQuery === 'function'
          ? queryOrGetQuery
          : () => queryOrGetQuery,
    };
    return this.extend(options) as any;
  }

  mutation<
    Q extends string | ((variables: any) => string),
    S extends Schema | undefined,
    E extends GQLEndpoint<any, any> = GQLEndpoint<any, any>,
  >(
    this: E,
    queryOrGetQuery: Q,
    schema?: S,
  ): GQLEndpoint<
    Q extends (variables: infer V) => string ? V : any,
    S,
    undefined
  > {
    const options: any = {
      sideEffect: true,
      schema,
      getQuery:
        typeof queryOrGetQuery === 'function'
          ? queryOrGetQuery
          : () => queryOrGetQuery,
    };
    return this.extend(options) as any;
  }
}
