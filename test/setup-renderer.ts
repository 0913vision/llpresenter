import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

// NOTE(0913vision): Testing Library unmounts on its own only when the test
// globals are on, and this project keeps them off.
afterEach(cleanup);
