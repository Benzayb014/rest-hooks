import { CacheProvider } from '@rest-hooks/react';
import { CacheProvider as ExternalCacheProvider } from '@rest-hooks/redux';
import { PollingArticleResource, Article } from '__tests__/new';
import nock from 'nock';
import React from 'react';

import { act, makeRenderRestHook } from '../../../../test';
import useLive from '../useLive';

function jsonNock() {
  return nock(/.*/).defaultReplyHeaders({
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
}

describe.each([
  ['CacheProvider', CacheProvider],
  ['ExternalCacheProvider', ExternalCacheProvider],
] as const)(`%s with subscriptions`, (_, makeProvider) => {
  const articlePayload = {
    id: 5,
    title: 'hi ho',
    content: 'whatever',
    tags: ['a', 'best', 'react'],
  };
  let renderRestHook: ReturnType<typeof makeRenderRestHook>;
  async function validateSubscription(
    result: {
      readonly current: Article | undefined;
      readonly error?: Error;
    },
    frequency: number,
    articlePayload: {
      id: number;
      title: string;
      content: string;
      tags: string[];
    },
    waitFor: <T>(callback: () => Promise<T> | T, options?: any) => Promise<T>,
  ) {
    // should be null to start
    expect(result.current).toBeUndefined();
    // should be defined after frequency milliseconds
    jest.advanceTimersByTime(frequency);
    await renderRestHook.allSettled();

    await waitFor(() => expect(result.current).not.toBeUndefined());
    expect(result.current).toBeInstanceOf(Article);
    expect(result.current).toEqual(Article.fromJS(articlePayload));
    // should update again after frequency
    const fiverNock = jsonNock()
      .get(`/article/${articlePayload.id}`)
      .reply(200, { ...articlePayload, title: 'fiver' });

    jest.advanceTimersByTime(frequency);

    await waitFor(() => expect(fiverNock.isDone()).toBeTruthy());
    await renderRestHook.allSettled();
    await waitFor(() => expect((result.current as any).title).toBe('fiver'));
  }

  function onError(e: any) {
    e.preventDefault();
  }
  beforeEach(() => {
    if (typeof addEventListener === 'function')
      addEventListener('error', onError);
  });
  afterEach(() => {
    if (typeof removeEventListener === 'function')
      removeEventListener('error', onError);
  });

  beforeAll(() => {
    PollingArticleResource.get.pollFrequency;
  });

  beforeEach(() => {
    nock(/.*/)
      .persist()
      .defaultReplyHeaders({
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      })
      .options(/.*/)
      .reply(200);
    jsonNock()
      .get(`/article-cooler/${articlePayload.id}`)
      .reply(200, articlePayload)
      .get(`/article/${articlePayload.id}`)
      .reply(200, articlePayload);
    renderRestHook = makeRenderRestHook(makeProvider);
  });
  afterEach(() => {
    renderRestHook.cleanup();
    nock.cleanAll();
    jest.useRealTimers();
  });

  it('useLive()', async () => {
    jest.useFakeTimers();
    const frequency = PollingArticleResource.get.pollFrequency as number;
    expect(frequency).toBeDefined();

    const { result, rerender, waitFor } = renderRestHook(
      ({ active }) => {
        return useLive(
          PollingArticleResource.get,
          active ? { id: articlePayload.id } : null,
        );
      },
      { initialProps: { active: true } },
    );

    await validateSubscription(result, frequency, articlePayload, waitFor);

    // should not update if active is false
    rerender({ active: false });
    jsonNock()
      .get(`/article/${articlePayload.id}`)
      .reply(200, { ...articlePayload, title: 'sixer' });
    jest.advanceTimersByTime(frequency);
    // @ts-expect-error
    () => result.current.title;
    () => result.current && result.current.title;
    expect(result.current).toBeUndefined();

    // errors should not fail when data already exists
    nock.cleanAll();
    const lastCall = jsonNock()
      .get(`/article/${articlePayload.id}`)
      .reply(403, () => {
        return { message: 'you fail' };
      });
    rerender({ active: true });
    expect((result.current as any).title).toBe('fiver');
    // not gonna try too hard to get the rest of this test working
    if (React.version.startsWith('18')) {
      jest.advanceTimersByTime(frequency);
      await waitFor(() => expect(lastCall.isDone()).toBeTruthy());
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      await renderRestHook.allSettled();

      expect((result.current as any).title).toBe('fiver');
    }
  });

  it('useSubscription() without active arg', async () => {
    jest.useFakeTimers();
    const frequency = PollingArticleResource.get.pollFrequency as number;
    expect(frequency).toBeDefined();
    expect(PollingArticleResource.anotherGet.pollFrequency).toBeDefined();

    const { result, waitFor } = renderRestHook(() => {
      return useLive(PollingArticleResource.get, { id: articlePayload.id });
    });

    await validateSubscription(result, frequency, articlePayload, waitFor);
    await renderRestHook.allSettled();
  });
});
