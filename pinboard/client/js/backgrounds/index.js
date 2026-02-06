// Background system barrel file
// Imports all background modules (triggering self-registration) and re-exports registry

// Basics
import './solid.js';
import './whiteBlack.js';

// Dots
import './polkadots.js';
import './confetti.js';
import './halftone.js';
import './bubbles.js';

// Stripes
import './stripes.js';
import './pinstripe.js';
import './candyStripe.js';
import './chevron.js';

// Textures
import './cork.js';
import './linen.js';
import './paper.js';

// Geometric
import './graphPaper.js';
import './checkerboard.js';
import './gingham.js';
import './diamond.js';
import './hexagonal.js';

// Decorative
import './scatteredShapes.js';
import './washiTape.js';
import './tornPaper.js';
import './splatter.js';

export {
  getBackground,
  listBackgrounds,
  getBackgroundsByCategory,
  getBackgroundDefaults,
  getBackgroundCategories
} from './registry.js';
