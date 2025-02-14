/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import type { Schema, NormalizedIndex, UnvisitFunction } from '../interface.js';
import { AbstractInstanceType } from '../normal.js';

export type Constructor = abstract new (...args: any[]) => {};
export type IDClass = abstract new (...args: any[]) => {
  id: string | number | undefined;
};
export type PKClass = abstract new (...args: any[]) => {
  pk(parent?: any, key?: string): string | undefined;
};

// TODO: Figure out what Schema must be for each key
type ValidSchemas<TInstance> = { [k in keyof TInstance]?: Schema };

export type EntityOptions<TInstance extends {}> = {
  readonly schema?: ValidSchemas<TInstance>;
  readonly pk?:
    | ((value: TInstance, parent?: any, key?: string) => string | undefined)
    | keyof TInstance;
  readonly key?: string;
} & {
  readonly [K in Extract<
    keyof IEntityClass,
    | 'process'
    | 'merge'
    | 'expiresAt'
    | 'createIfValid'
    | 'mergeWithStore'
    | 'validate'
    | 'shouldReorder'
    | 'useIncoming'
  >]?: IEntityClass<abstract new (...args: any[]) => TInstance>[K];
};

export interface RequiredPKOptions<TInstance extends {}>
  extends EntityOptions<TInstance> {
  readonly pk:
    | ((value: TInstance, parent?: any, key?: string) => string | undefined)
    | keyof TInstance;
}

export default function EntitySchema<TBase extends Constructor>(
  Base: TBase,
  options: EntityOptions<InstanceType<TBase>> = {},
) {
  /**
   * Represents data that should be deduped by specifying a primary key.
   * @see https://resthooks.io/docs/api/Entity
   */
  abstract class EntityMixin extends Base {
    static toString() {
      return this.key;
    }

    static toJSON() {
      return {
        name: this.name,
        schema: this.schema,
        key: this.key,
      };
    }

    /** Defines nested entities */
    declare static schema: { [k: string]: Schema };

    /**
     * A unique identifier for each Entity
     *
     * @param [parent] When normalizing, the object which included the entity
     * @param [key] When normalizing, the key where this entity was found
     */
    abstract pk(parent?: any, key?: string): string | undefined;

    /** Returns the globally unique identifier for the static Entity */
    declare static key: string;
    // default implementation in class static block at bottom of definition

    /** Defines indexes to enable lookup by */
    declare static indexes?: readonly string[];

    /**
     * A unique identifier for each Entity
     *
     * @param [value] POJO of the entity or subset used
     * @param [parent] When normalizing, the object which included the entity
     * @param [key] When normalizing, the key where this entity was found
     */
    static pk<T extends typeof EntityMixin>(
      this: T,
      value: Partial<AbstractInstanceType<T>>,
      parent?: any,
      key?: string,
    ): string | undefined {
      return this.prototype.pk.call(value, parent, key);
    }

    /** Return true to merge incoming data; false keeps existing entity
     *
     * @see https://resthooks.io/docs/api/schema.Entity#useIncoming
     */
    static useIncoming(
      existingMeta: { date: number; fetchedAt: number },
      incomingMeta: { date: number; fetchedAt: number },
      existing: any,
      incoming: any,
    ) {
      return true;
    }

    /** Determines the order of incoming entity vs entity already in store\
     *
     * @see https://resthooks.io/docs/api/schema.Entity#shouldReorder
     * @returns true if incoming entity should be first argument of merge()
     */
    static shouldReorder(
      existingMeta: { date: number; fetchedAt: number },
      incomingMeta: { date: number; fetchedAt: number },
      existing: any,
      incoming: any,
    ) {
      return incomingMeta.fetchedAt < existingMeta.fetchedAt;
    }

    /** Creates new instance copying over defined values of arguments */
    static merge(existing: any, incoming: any) {
      return {
        ...existing,
        ...incoming,
      };
    }

    /** Run when an existing entity is found in the store */
    static mergeWithStore(
      existingMeta: {
        date: number;
        fetchedAt: number;
      },
      incomingMeta: { date: number; fetchedAt: number },
      existing: any,
      incoming: any,
    ) {
      const useIncoming = this.useIncoming(
        existingMeta,
        incomingMeta,
        existing,
        incoming,
      );

      if (useIncoming) {
        // distinct types are not mergeable (like delete symbol), so just replace
        if (typeof incoming !== typeof existing) {
          return incoming;
        } else {
          return this.shouldReorder(
            existingMeta,
            incomingMeta,
            existing,
            incoming,
          )
            ? this.merge(incoming, existing)
            : this.merge(existing, incoming);
        }
      } else {
        return existing;
      }
    }

    /** Factory method to convert from Plain JS Objects.
     *
     * @param [props] Plain Object of properties to assign.
     */
    static fromJS<T extends typeof EntityMixin>(
      this: T,
      // TODO: this should only accept members that are not functions
      props: Partial<AbstractInstanceType<T>> = {},
    ): AbstractInstanceType<T> {
      // we type guarded abstract case above, so ok to force typescript to allow constructor call
      const instance = new (this as any)(props) as AbstractInstanceType<T>;
      // we can't rely on constructors and override the defaults provided as property assignments
      // all occur after the constructor
      Object.assign(instance, props);
      return instance;
    }

    /** Factory method to convert from Plain JS Objects.
     *
     * @param [props] Plain Object of properties to assign.
     */
    static createIfValid<T extends typeof EntityMixin>(
      this: T,
      // TODO: this should only accept members that are not functions
      props: Partial<AbstractInstanceType<T>>,
    ): AbstractInstanceType<T> | undefined {
      if (this.validate(props)) {
        return undefined as any;
      }
      return this.fromJS(props);
    }

    /** Do any transformations when first receiving input */
    static process(input: any, parent: any, key: string | undefined): any {
      return { ...input };
    }

    static normalize(
      input: any,
      parent: any,
      key: string | undefined,
      visit: (...args: any) => any,
      addEntity: (...args: any) => any,
      visitedEntities: Record<string, any>,
    ): any {
      const processedEntity = this.process(input, parent, key);
      const id = this.pk(processedEntity, parent, key);
      if (id === undefined || id === '') {
        if (process.env.NODE_ENV !== 'production') {
          const error = new Error(
            `Missing usable primary key when normalizing response.

  This is likely due to a malformed response.
  Try inspecting the network response or fetch() return value.
  Or use debugging tools: https://resthooks.io/docs/guides/debugging
  Learn more about primary keys: https://resthooks.io/rest/api/Entity#pk

  Entity: ${this.name}
  Value (processed): ${
    processedEntity && JSON.stringify(processedEntity, null, 2)
  }
  `,
          );
          (error as any).status = 400;
          throw error;
        } else {
          // these make the keys get deleted
          return undefined;
        }
      }
      const entityType = this.key;

      if (!(entityType in visitedEntities)) {
        visitedEntities[entityType] = {};
      }
      if (!(id in visitedEntities[entityType])) {
        visitedEntities[entityType][id] = [];
      }
      if (
        visitedEntities[entityType][id].some((entity: any) => entity === input)
      ) {
        return id;
      }
      const errorMessage = this.validate(processedEntity);
      throwValidationError(errorMessage);

      visitedEntities[entityType][id].push(input);

      Object.keys(this.schema).forEach(key => {
        if (Object.hasOwn(processedEntity, key)) {
          const schema = this.schema[key];
          processedEntity[key] = visit(
            processedEntity[key],
            processedEntity,
            key,
            schema,
            addEntity,
            visitedEntities,
          );
        }
      });

      addEntity(this, processedEntity, id);
      return id;
    }

    static validate(processedEntity: any): string | undefined {
      if (process.env.NODE_ENV !== 'production') {
        for (const key of Object.keys(this.schema)) {
          if (!Object.hasOwn(processedEntity, key)) {
            if (!Object.hasOwn(this.defaults, key)) {
              return `Schema key is missing in Entity

  Be sure all schema members are also part of the entity
  Or use debugging tools: https://resthooks.io/docs/guides/debugging
  Learn more about nesting schemas: https://resthooks.io/rest/guides/nested-response

  Entity keys: ${Object.keys(this.defaults)}
  Schema key(missing): ${key}
  `;
            }
          }
        }
      }
    }

    static infer(
      args: readonly any[],
      indexes: NormalizedIndex,
      recurse: any,
    ): any {
      if (!args[0]) return undefined;
      if (['string', 'number'].includes(typeof args[0])) {
        return `${args[0]}`;
      }
      const id = this.pk(args[0], undefined, '');
      // Was able to infer the entity's primary key from params
      if (id !== undefined && id !== '') return id;
      // now attempt lookup in indexes
      const indexName = indexFromParams(args[0], this.indexes);
      if (indexName && indexes[this.key]) {
        // 'as Record<string, any>': indexName can only be found if params is a string key'd object
        const id =
          indexes[this.key][indexName][
            (args[0] as Record<string, any>)[indexName]
          ];
        return id;
      }
      return undefined;
    }

    static expiresAt(
      meta: { expiresAt: number; date: number; fetchedAt: number },
      input: any,
    ): number {
      return meta.expiresAt;
    }

    static denormalize<T extends typeof EntityMixin>(
      this: T,
      input: any,
      unvisit: UnvisitFunction,
    ): [
      denormalized: AbstractInstanceType<T>,
      found: boolean,
      suspend: boolean,
    ] {
      // TODO: remove codecov ignore once denormalize is modified to expect this
      /* istanbul ignore if */
      if (typeof input === 'symbol') {
        return [undefined, true, true] as any;
      }

      let deleted = false;
      // note: iteration order must be stable
      Object.keys(this.schema).forEach(key => {
        const schema = this.schema[key];
        const nextInput = (input as any)[key];
        const [value, , deletedItem] = unvisit(nextInput, schema);

        if (deletedItem && !!this.defaults[key]) {
          deleted = true;
        }
        input[key] = value;
      });

      return [input, true, deleted];
    }

    /** All instance defaults set */
    static get defaults() {
      // we use hasOwn because we don't want to use a parents' defaults
      if (!Object.hasOwn(this, '__defaults'))
        Object.defineProperty(this, '__defaults', {
          value: new (this as any)(),
          writable: true,
          configurable: true,
        });
      return (this as any).__defaults;
    }
  }

  const { pk, schema, key, ...staticProps } = options;
  // remaining options
  Object.assign(EntityMixin, staticProps);

  if ('schema' in options) {
    EntityMixin.schema = options.schema as any;
  } else if (!(Base as any).schema) {
    EntityMixin.schema = {};
  }
  if ('pk' in options) {
    if (typeof options.pk === 'function') {
      EntityMixin.prototype.pk = function (parent?: any, key?: string) {
        return (options.pk as any)(this, parent, key);
      };
    } else {
      EntityMixin.prototype.pk = function () {
        return this[options.pk];
      };
    }
    // default to 'id' field if the base class doesn't have a pk
  } else if (typeof Base.prototype.pk !== 'function') {
    EntityMixin.prototype.pk = function () {
      return this.id;
    };
  }
  if ('key' in options) {
    Object.defineProperty(EntityMixin, 'key', {
      value: options.key,
      configurable: true,
      writable: true,
    });
  } else if (!('key' in Base)) {
    // this allows assignment in strict-mode
    // eslint-disable-next-line no-inner-declarations
    function set(this: any, value: string) {
      Object.defineProperty(this, 'key', {
        value,
        writable: true,
        enumerable: true,
      });
    }
    const CLASSNAMEMANGLING = EntityMixin.name !== 'EntityMixin';
    const get =
      /* istanbul ignore if */
      CLASSNAMEMANGLING
        ? /* istanbul ignore next */ function (this: {
            name: string;
            key: string;
          }): string {
            console.error('Rest Hooks Error: https://resthooks.io/errors/dklj');
            Object.defineProperty(this, 'key', {
              get() {
                return Base.name;
              },
              set,
            });
            return this.key;
          }
        : function (this: { name: string }): string {
            const name = this.name === 'EntityMixin' ? Base.name : this.name;
            /* istanbul ignore next */
            if (
              process.env.NODE_ENV !== 'production' &&
              (name === '' || name === 'EntityMixin' || name === '_temp')
            )
              throw new Error(
                'Entity classes without a name must define `static key`\nSee: https://resthooks.io/rest/api/Entity#key',
              );
            return name;
          };

    Object.defineProperty(EntityMixin, 'key', {
      get,
      set,
    });
  }

  return EntityMixin as any;
}

function indexFromParams<I extends string>(
  params: Readonly<object>,
  indexes?: Readonly<I[]>,
) {
  if (!indexes) return undefined;
  return indexes.find(index => Object.hasOwn(params, index));
}

// part of the reason for pulling this out is that all functions that throw are deoptimized
function throwValidationError(errorMessage: string | undefined) {
  if (errorMessage) {
    const error = new Error(errorMessage);
    (error as any).status = 400;
    throw error;
  }
}

export interface IEntityClass<TBase extends Constructor = any> {
  toJSON(): {
    name: string;
    schema: {
      [k: string]: Schema;
    };
    key: string;
  };
  /** Defines nested entities */
  schema: {
    [k: string]: Schema;
  };
  /** Returns the globally unique identifier for the static Entity */
  key: string;
  /** Defines indexes to enable lookup by */
  indexes?: readonly string[] | undefined;
  /**
   * A unique identifier for each Entity
   *
   * @param [value] POJO of the entity or subset used
   * @param [parent] When normalizing, the object which included the entity
   * @param [key] When normalizing, the key where this entity was found
   */
  pk<
    T extends (abstract new (...args: any[]) => IEntityInstance &
      InstanceType<TBase>) &
      IEntityClass &
      TBase,
  >(
    this: T,
    value: Partial<AbstractInstanceType<T>>,
    parent?: any,
    key?: string,
  ): string | undefined;
  /** Return true to merge incoming data; false keeps existing entity
   *
   * @see https://resthooks.io/docs/api/schema.Entity#useIncoming
   */
  useIncoming(
    existingMeta: {
      date: number;
      fetchedAt: number;
    },
    incomingMeta: {
      date: number;
      fetchedAt: number;
    },
    existing: any,
    incoming: any,
  ): boolean;
  /** Determines the order of incoming entity vs entity already in store\
   *
   * @see https://resthooks.io/docs/api/schema.Entity#shouldReorder
   * @returns true if incoming entity should be first argument of merge()
   */
  shouldReorder(
    existingMeta: { date: number; fetchedAt: number },
    incomingMeta: { date: number; fetchedAt: number },
    existing: any,
    incoming: any,
  ): boolean;
  /** Creates new instance copying over defined values of arguments */
  merge(existing: any, incoming: any): any;
  /** Run when an existing entity is found in the store */
  mergeWithStore(
    existingMeta: {
      date: number;
      fetchedAt: number;
    },
    incomingMeta: {
      date: number;
      fetchedAt: number;
    },
    existing: any,
    incoming: any,
  ): any;
  /** Factory method to convert from Plain JS Objects.
   *
   * @param [props] Plain Object of properties to assign.
   */
  fromJS<
    T extends (abstract new (...args: any[]) => IEntityInstance &
      InstanceType<TBase>) &
      IEntityClass &
      TBase,
  >(
    this: T,
    props?: Partial<AbstractInstanceType<T>>,
  ): AbstractInstanceType<T>;
  /** Factory method to convert from Plain JS Objects.
   *
   * @param [props] Plain Object of properties to assign.
   */
  createIfValid<
    T extends (abstract new (...args: any[]) => IEntityInstance &
      InstanceType<TBase>) &
      IEntityClass &
      TBase,
  >(
    this: T,
    props: Partial<AbstractInstanceType<T>>,
  ): AbstractInstanceType<T> | undefined;
  /** Do any transformations when first receiving input */
  process(input: any, parent: any, key: string | undefined): any;
  normalize(
    input: any,
    parent: any,
    key: string | undefined,
    visit: (...args: any) => any,
    addEntity: (...args: any) => any,
    visitedEntities: Record<string, any>,
  ): any;
  validate(processedEntity: any): string | undefined;
  infer(args: readonly any[], indexes: NormalizedIndex, recurse: any): any;
  expiresAt(
    meta: {
      expiresAt: number;
      date: number;
      fetchedAt: number;
    },
    input: any,
  ): number;
  denormalize<
    T extends (abstract new (...args: any[]) => IEntityInstance &
      InstanceType<TBase>) &
      IEntityClass &
      TBase,
  >(
    this: T,
    input: any,
    unvisit: UnvisitFunction,
  ): [denormalized: AbstractInstanceType<T>, found: boolean, suspend: boolean];
  /** All instance defaults set */
  readonly defaults: any;
  //set(entity: any, key: string, value: any): void;
}
export interface IEntityInstance {
  /**
   * A unique identifier for each Entity
   *
   * @param [parent] When normalizing, the object which included the entity
   * @param [key] When normalizing, the key where this entity was found
   */
  pk(parent?: any, key?: string): string | undefined;
}
