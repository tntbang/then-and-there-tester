// Central state management module

const initialState = {
  photos: [],
  photoOrder: [],
  globalParams: {
    orientation: 'portrait',
    aspectRatio: 2.17,
    seed: 12345,
    pinboardStyle: 'solid',
    backgroundColor: 0,
    dotColor: 1,
    stripeColor1: 0,
    stripeColor2: 1
  },
  arrangementId: 'grid',
  arrangementParams: {},
  palette: null,
  availablePalettes: [],
  presets: []
};

let state = { ...initialState };
const listeners = new Set();

/**
 * Get the current state
 * @returns {Object} The current state
 */
export function getState() {
  return state;
}

/**
 * Update state with partial values (shallow merge)
 * @param {Object} partial - Partial state to merge
 */
export function setState(partial) {
  state = { ...state, ...partial };
  notifyListeners();
}

/**
 * Subscribe to state changes
 * @param {Function} listener - Callback function called on state change
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error('State listener error:', err);
    }
  }
}

/**
 * Reset state to initial values
 */
export function resetState() {
  state = { ...initialState };
  notifyListeners();
}

/**
 * Get photos in their display order
 * @returns {Array} Ordered photos array
 */
export function getOrderedPhotos() {
  const { photos, photoOrder } = state;
  const photoMap = new Map(photos.map(p => [p.id, p]));
  return photoOrder.map(id => photoMap.get(id)).filter(Boolean);
}

/**
 * Update a specific global parameter
 * @param {string} key - Parameter key
 * @param {*} value - Parameter value
 */
export function setGlobalParam(key, value) {
  setState({
    globalParams: { ...state.globalParams, [key]: value }
  });
}

/**
 * Update a specific arrangement parameter
 * @param {string} key - Parameter key
 * @param {*} value - Parameter value
 */
export function setArrangementParam(key, value) {
  setState({
    arrangementParams: { ...state.arrangementParams, [key]: value }
  });
}
