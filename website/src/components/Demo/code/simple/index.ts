import { GQLEndpoint } from '@rest-hooks/graphql';

import fetchDemo from './fetch';
import graphqlDemo from './graphql';
import restDemo from './rest';
import { TODOS } from '../../../../mocks/handlers';

export default [fetchDemo, restDemo, graphqlDemo];
