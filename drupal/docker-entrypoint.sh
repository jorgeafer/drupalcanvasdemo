#!/bin/bash
set -e

DB_HOST="${DRUPAL_DB_HOST:-db}"
DB_NAME="${DRUPAL_DB_NAME:-drupal}"
DB_USER="${DRUPAL_DB_USER:-drupal}"
DB_PASS="${DRUPAL_DB_PASSWORD:-drupal}"
ADMIN_USER="${DRUPAL_ADMIN_USER:-admin}"
ADMIN_PASS="${DRUPAL_ADMIN_PASSWORD:-admin123}"
SITE_NAME="${DRUPAL_SITE_NAME:-DrupalCanvas}"
GROQ_KEY="${GROQ_API_KEY:-}"

# ── Wait for MySQL ─────────────────────────────────────────────────────────
echo "[Canvas] Waiting for database at ${DB_HOST}..."
until mysqladmin ping -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASS}" --silent 2>/dev/null; do
  echo "[Canvas] Database not ready, retrying in 3s..."
  sleep 3
done
echo "[Canvas] Database is ready!"

# ── Detect if already installed ────────────────────────────────────────────
SETTINGS_FILE="/var/www/html/web/sites/default/settings.php"
INSTALLED=false

if [ -f "$SETTINGS_FILE" ] && grep -q "database" "$SETTINGS_FILE" 2>/dev/null; then
  INSTALLED=true
fi

if [ "$INSTALLED" = "false" ]; then

  echo "[Canvas] Installing Drupal CMS 2.0..."

  # Ensure writable settings directory
  chmod 755 /var/www/html/web/sites/default 2>/dev/null || true
  cp /var/www/html/web/sites/default/default.settings.php "$SETTINGS_FILE" 2>/dev/null || true
  chmod 666 "$SETTINGS_FILE" 2>/dev/null || true

  # Run site install (drupal/cms ships with its own profile/recipe)
  drush site:install \
    --db-url="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}" \
    --site-name="${SITE_NAME}" \
    --account-name="${ADMIN_USER}" \
    --account-pass="${ADMIN_PASS}" \
    --account-mail="admin@drupalcanvas.local" \
    --yes 2>&1

  echo "[Canvas] Enabling Canvas and AI modules..."

  # Canvas is included in drupal/cms but may need explicit enabling
  drush pm:enable canvas --yes 2>&1 || true

  # Drupal AI module + Groq provider (optional — container starts even if unavailable)
  if drush pm:enable ai key ai_provider_groq --yes 2>&1; then

    echo "[Canvas] Configuring Groq AI provider..."

    drush php:eval "
      // 1. Create a Key entity to securely store the Groq API key
      if (!\Drupal\key\Entity\Key::load('groq_api_key')) {
        \Drupal\key\Entity\Key::create([
          'id'                   => 'groq_api_key',
          'label'                => 'Groq API Key',
          'key_type'             => 'authentication',
          'key_provider'         => 'config',
          'key_provider_settings' => ['key_value' => '${GROQ_KEY}'],
        ])->save();
        echo 'Groq key entity created.' . PHP_EOL;
      }

      // 2. Point the Groq provider to that key
      \Drupal::configFactory()
        ->getEditable('ai_provider_groq.settings')
        ->set('api_key', 'groq_api_key')
        ->save();

      // 3. Set llama-3.3-70b-versatile as the default chat model
      \Drupal::configFactory()
        ->getEditable('ai.settings')
        ->set('default_providers.chat', ['provider_id' => 'groq', 'model_id' => 'llama-3.3-70b-versatile'])
        ->save();

      echo 'Groq provider configured.' . PHP_EOL;
    " 2>&1 || echo "[Canvas] Groq config step skipped."

  else
    echo "[Canvas] AI/Groq modules not available — skipping native AI config. The Node.js bridge (port 3000) still works."
  fi

  # Enable our custom canvas_ai supplement module (admin chat page)
  drush pm:enable canvas_ai --yes 2>&1 || echo "[Canvas] canvas_ai supplement module skipped (optional)."

  echo "[Canvas] Enabling Tibidabo theme..."
  drush theme:enable tibidabo --yes 2>&1 || echo "[Canvas] tibidabo theme enable skipped (optional)."
  drush config:set system.theme default tibidabo --yes 2>&1 || true

  echo "[Canvas] Configuring permissions..."
  drush php:eval "
    \$admin = \Drupal\user\Entity\Role::load('administrator');
    if (\$admin) {
      \$admin->grantPermission('access administration pages');
      \$admin->grantPermission('administer ai');
      \$admin->save();
    }
  " 2>&1 || true

  drush cache:rebuild 2>&1

  echo ""
  echo "=============================================="
  echo "  DrupalCanvas (CMS 2.0 + Canvas AI) ready!"
  echo "  URL:      http://localhost:8080"
  echo "  Admin:    ${ADMIN_USER} / ${ADMIN_PASS}"
  echo "  Canvas:   /node/add  →  choose Canvas page"
  echo "  AI Chat:  /admin/canvas-ai  (custom bridge)"
  echo "=============================================="
  echo ""

else
  echo "[Canvas] Already installed, refreshing caches..."
  drush cache:rebuild 2>&1 || true
fi

exec "$@"
