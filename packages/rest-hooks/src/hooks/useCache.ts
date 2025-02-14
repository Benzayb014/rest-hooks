/* eslint-disable @typescript-eslint/ban-types */
import type {
  FetchFunction,
  Schema,
  DenormalizeNullable,
  EndpointInterface,
  ResolveType,
} from '@rest-hooks/react';
import { useCache as useCacheNew } from '@rest-hooks/react';
import { useMemo } from 'react';

import shapeToEndpoint from '../endpoint/adapter.js';
import { ReadShape, ParamsFromShape } from '../endpoint/index.js';

/**
 * Access a response if it is available.
 *
 * `useCache` guarantees referential equality globally.
 * @see https://resthooks.io/docs/api/useCache
 */
export default function useCache<
  E extends
    | Pick<
        EndpointInterface<FetchFunction, Schema | undefined, undefined | false>,
        'key' | 'schema' | 'invalidIfStale'
      >
    | Pick<ReadShape<any, any>, 'getFetchKey' | 'schema' | 'options'>,
  Args extends
    | (E extends { key: any }
        ? readonly [...Parameters<E['key']>]
        : readonly [ParamsFromShape<E>])
    | readonly [null],
>(
  endpoint: E,
  ...args: Args
): E['schema'] extends {}
  ? DenormalizeNullable<E['schema']>
  : E extends (...args: any) => any
  ? ResolveType<E> | undefined
  : any {
  const adaptedEndpoint: any = useMemo(() => {
    return shapeToEndpoint(endpoint);
    // we currently don't support shape changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useCacheNew(adaptedEndpoint, ...args);
}
