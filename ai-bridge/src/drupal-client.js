import axios from 'axios';

const DRUPAL_URL = process.env.DRUPAL_URL || 'http://drupal';
const DRUPAL_USER = process.env.DRUPAL_USER || 'admin';
const DRUPAL_PASS = process.env.DRUPAL_PASSWORD || 'admin123';

const auth = {
  username: DRUPAL_USER,
  password: DRUPAL_PASS,
};

/**
 * Returns the Drupal URL that is reachable from the user's browser.
 * In GitHub Codespaces the internal hostname differs from the public URL,
 * so we detect CODESPACE_NAME and build the forwarded-port URL automatically.
 */
function getPublicDrupalUrl() {
  if (process.env.CODESPACE_NAME) {
    return `https://${process.env.CODESPACE_NAME}-8080.app.github.dev`;
  }
  return process.env.DRUPAL_PUBLIC_URL || 'http://localhost:8080';
}

/**
 * Creates a canvas_page node in Drupal via JSON:API.
 * Returns { url, nodeId } on success or throws on error.
 */
export async function createCanvasPage(title, components) {
  const endpoint = `${DRUPAL_URL}/jsonapi/node/canvas_page`;

  const payload = {
    data: {
      type: 'node--canvas_page',
      attributes: {
        title,
        status: 1,
        field_canvas_data: {
          value: JSON.stringify(components, null, 2),
        },
      },
    },
  };

  const response = await axios.post(endpoint, payload, {
    auth,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    timeout: 15000,
  });

  const nodeId = response.data?.data?.attributes?.drupal_internal__nid;
  const drupalPath = nodeId ? `/node/${nodeId}` : '/';

  return {
    nodeId,
    drupalPath,
    publicUrl: `${getPublicDrupalUrl()}${drupalPath}`,
    internalUrl: `${DRUPAL_URL}${drupalPath}`,
  };
}

/**
 * Simple health-check – returns true when Drupal's JSON:API is reachable.
 */
export async function isDrupalReady() {
  try {
    await axios.get(`${DRUPAL_URL}/jsonapi`, {
      auth,
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}
