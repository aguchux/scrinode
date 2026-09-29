import base from '@scrinode/eslint-config';
import { boundaries } from '@scrinode/eslint-config/boundaries';

// allowAi: this package owns the vendor adapters. §8 forbids vendor AI SDKs
// everywhere else precisely so they are confined here.
export default [...base, boundaries({ allowAi: true })];
