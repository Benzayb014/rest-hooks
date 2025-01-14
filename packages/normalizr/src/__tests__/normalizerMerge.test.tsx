import { schema } from '@rest-hooks/endpoint';
import { Article, IDEntity } from '__tests__/new';

import { denormalize } from '../denormalize';
import { normalize } from '../normalize';

describe('normalizer() merging', () => {
  describe('with instance.constructor.merge()', () => {
    it('should merge two Resource instances', () => {
      const id = 20;
      const { entities: first, entityMeta: firstEM } = normalize(
        {
          id,
          title: 'hi',
          content: 'this is the content',
        },
        Article,
      );

      const { result, entities } = normalize(
        { id, title: 'hello' },
        Article,
        first,
        {},
        firstEM,
      );

      const [merged] = denormalize(result, Article, entities);
      expect(merged).toBeInstanceOf(Article);
      expect(merged).toEqual(
        Article.fromJS({
          id,
          title: 'hello',
          content: 'this is the content',
        }),
      );
    });

    it('should not affect merging of plain objects', () => {
      const id = 20;
      const entitiesA = {
        [Article.key]: {
          [id]: Article.fromJS({
            id,
            title: 'hi',
            content: 'this is the content',
          }),
          [42]: Article.fromJS({
            id: 42,
            title: 'dont touch me',
            content: 'this is mine',
          }),
        },
      };

      const { entities } = normalize(
        { id, title: 'hi', content: 'this is the content' },
        Article,
        entitiesA,
      );

      expect(entities[Article.key][42]).toBe(entitiesA[Article.key][42]);
    });
  });

  describe('basics', function () {
    it('should assign `null` values', () => {
      const id = 20;
      const { entities: first, entityMeta: firstEM } = normalize(
        {
          id,
          title: 'hi',
          content: 'this is the content',
        },
        Article,
      );

      const { result, entities } = normalize(
        { id, title: null },
        Article,
        first,
        {},
        firstEM,
      );

      const [merged] = denormalize(result, Article, entities);
      expect(merged).toBeInstanceOf(Article);
      expect(merged).toEqual(
        Article.fromJS({
          id,
          title: null as any,
          content: 'this is the content',
        }),
      );
    });

    it('should not augment source objects', () => {
      const id = 20;
      const { entities: first } = normalize(
        {
          id,
          title: 'hi',
          content: 'this is the content',
        },
        Article,
      );

      normalize({ id, title: 'hello' }, Article, first);

      const [merged] = denormalize(id, Article, first);
      expect(merged).toBeInstanceOf(Article);
      expect(merged).toEqual(
        Article.fromJS({
          id,
          title: 'hi',
          content: 'this is the content',
        }),
      );
    });

    it('should still clone even when overwriting', () => {
      const id = 20;
      const { entities: first } = normalize({ id }, new schema.Delete(Article));

      const nested = { id, title: 'hello' };
      const { entities } = normalize(nested, Article, first);

      expect(entities).toMatchInlineSnapshot(`
        {
          "Article": {
            "20": {
              "id": 20,
              "title": "hello",
            },
          },
        }
      `);

      expect(entities[Article.key][id]).not.toBe(nested);
    });
  });

  describe('legacy (missing Entity.mergeWithStore)', () => {
    it('should work', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      class User extends IDEntity {
        static mergeWithStore = undefined;
      }
      const id = 20;
      const entitiesA = {
        [User.key]: {
          [id]: {
            id,
            title: 'instore',
            content: 'instore content',
          },
          [42]: {
            id: 42,
            title: 'dont touch me',
            content: 'this is mine',
          },
        },
      };

      const { entities } = normalize(
        { id, title: 'hi', content: 'this is the content' },
        User,
        entitiesA,
      );

      expect(entities[User.key][id]).toEqual({
        id,
        title: 'hi',
        content: 'this is the content',
      });
    });
    it('should skip incoming when set', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      class User extends IDEntity {
        static mergeWithStore = undefined;
        static useIncoming(
          existingMeta: { date: number; fetchedAt: number },
          incomingMeta: { date: number; fetchedAt: number },
          existing: any,
          incoming: any,
        ): boolean {
          return false;
        }
      }
      const id = 20;
      const entitiesA = {
        [User.key]: {
          [id]: {
            id,
            title: 'instore',
            content: 'instore content',
          },
          [42]: {
            id: 42,
            title: 'dont touch me',
            content: 'this is mine',
          },
        },
      };
      const meta = {
        [User.key]: {
          [id]: {
            date: 0,
            fetchedAt: 0,
            expiresAt: Infinity,
          },
          [42]: {
            date: 0,
            fetchedAt: 0,
            expiresAt: Infinity,
          },
        },
      };

      const { entities } = normalize(
        { id, title: 'hi', content: 'this is the content' },
        User,
        entitiesA,
        {},
        meta,
        {
          date: Date.now(),
          expiresAt: Infinity,
          fetchedAt: Date.now(),
        },
      );

      expect(entities[User.key][id]).toBe(entitiesA[User.key][id]);
    });
  });
});
