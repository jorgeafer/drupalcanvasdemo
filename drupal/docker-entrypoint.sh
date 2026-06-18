#!/bin/bash
set -e

DB_HOST="${DRUPAL_DB_HOST:-db}"
DB_NAME="${DRUPAL_DB_NAME:-drupal}"
DB_USER="${DRUPAL_DB_USER:-drupal}"
DB_PASS="${DRUPAL_DB_PASSWORD:-drupal}"
ADMIN_USER="${DRUPAL_ADMIN_USER:-admin}"
ADMIN_PASS="${DRUPAL_ADMIN_PASSWORD:-admin123}"
SITE_NAME="${DRUPAL_SITE_NAME:-DrupalCanvas}"

echo "[Canvas] Waiting for database at ${DB_HOST}..."
until mysqladmin ping -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASS}" --silent 2>/dev/null; do
  echo "[Canvas] Database not ready, retrying in 3s..."
  sleep 3
done
echo "[Canvas] Database is ready!"

# Check if Drupal is already installed by testing if settings.php has db config
SETTINGS_FILE="/var/www/html/web/sites/default/settings.php"
INSTALLED=false

if [ -f "$SETTINGS_FILE" ]; then
  if grep -q "database" "$SETTINGS_FILE" 2>/dev/null; then
    INSTALLED=true
  fi
fi

if [ "$INSTALLED" = "false" ]; then
  echo "[Canvas] Running Drupal site installation..."

  # Make sites/default writable
  chmod 755 /var/www/html/web/sites/default 2>/dev/null || true
  cp /var/www/html/web/sites/default/default.settings.php \
     /var/www/html/web/sites/default/settings.php 2>/dev/null || true
  chmod 666 /var/www/html/web/sites/default/settings.php 2>/dev/null || true

  drush site:install minimal \
    --db-url="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}" \
    --site-name="${SITE_NAME}" \
    --account-name="${ADMIN_USER}" \
    --account-pass="${ADMIN_PASS}" \
    --account-mail="admin@drupalcanvas.local" \
    --yes 2>&1

  echo "[Canvas] Enabling required modules..."
  drush pm:enable \
    node \
    field \
    text \
    jsonapi \
    basic_auth \
    serialization \
    --yes 2>&1

  echo "[Canvas] Enabling canvas_ai module..."
  drush pm:enable canvas_ai --yes 2>&1

  echo "[Canvas] Configuring JSON:API permissions..."
  drush php:eval "
    \$roles = ['authenticated', 'anonymous'];
    foreach (\$roles as \$role_id) {
      \$role = \Drupal\user\Entity\Role::load(\$role_id);
      if (\$role) {
        \$role->grantPermission('access jsonapi resource list');
        \$role->grantPermission('view published content');
        \$role->grantPermission('access content');
        \$role->save();
      }
    }
    \$admin = \Drupal\user\Entity\Role::load('administrator');
    if (\$admin) {
      \$admin->grantPermission('access jsonapi resource list');
      \$admin->grantPermission('create canvas_page content');
      \$admin->grantPermission('edit any canvas_page content');
      \$admin->save();
    }
    echo 'Permissions configured.' . PHP_EOL;
  " 2>&1

  echo "[Canvas] Rebuilding caches..."
  drush cache:rebuild 2>&1

  echo ""
  echo "================================================"
  echo "  DrupalCanvas installed successfully!"
  echo "  URL:      http://localhost:8080"
  echo "  Admin:    ${ADMIN_USER} / ${ADMIN_PASS}"
  echo "  AI Chat:  http://localhost:3000"
  echo "================================================"
  echo ""
else
  echo "[Canvas] Drupal already installed, refreshing caches..."
  drush cache:rebuild 2>&1 || true
fi

exec "$@"
