FROM php:8.3-apache-bookworm

# ── System dependencies ────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        unzip \
        curl \
        default-mysql-client \
        libfreetype6-dev \
        libjpeg-dev \
        libpng-dev \
        libwebp-dev \
        libzip-dev \
        libpq-dev \
        libonig-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" \
        gd \
        opcache \
        pdo_mysql \
        zip \
        mbstring \
        exif \
        bcmath \
    && rm -rf /var/lib/apt/lists/*

# ── PHP tuning ─────────────────────────────────────────────────────────────
RUN { \
    echo 'memory_limit = 512M'; \
    echo 'upload_max_filesize = 64M'; \
    echo 'post_max_size = 64M'; \
    echo 'max_execution_time = 300'; \
    echo 'opcache.memory_consumption = 256'; \
    echo 'opcache.interned_strings_buffer = 16'; \
    echo 'opcache.max_accelerated_files = 10000'; \
} > /usr/local/etc/php/conf.d/drupal.ini

# ── Apache: serve from web/ subdirectory (Drupal CMS project layout) ──────
RUN a2enmod rewrite && \
    printf '<VirtualHost *:80>\n\
  ServerAdmin webmaster@localhost\n\
  DocumentRoot /var/www/html/web\n\
  <Directory /var/www/html/web>\n\
    Options Indexes FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
  </Directory>\n\
  ErrorLog ${APACHE_LOG_DIR}/error.log\n\
  CustomLog ${APACHE_LOG_DIR}/access.log combined\n\
</VirtualHost>\n' > /etc/apache2/sites-available/000-default.conf

# ── Composer ───────────────────────────────────────────────────────────────
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_HOME=/root/.composer \
    COMPOSER_PROCESS_TIMEOUT=600 \
    COMPOSER_NO_INTERACTION=1

# ── Create Drupal CMS 2.0 project ─────────────────────────────────────────
# This installs Drupal 11 + Canvas + AI modules as defined by drupal/cms:^2
WORKDIR /var/www/html
RUN composer create-project drupal/cms:^2 . --no-progress 2>&1 | tail -20

# ── Drush ─────────────────────────────────────────────────────────────────
RUN composer require drush/drush --no-progress && \
    ln -sf /var/www/html/vendor/bin/drush /usr/local/bin/drush

# ── Drupal AI modules + Groq provider ────────────────────────────────────
# drupal/key and drupal/ai may already be pulled by drupal/cms:^2; requiring
# them explicitly guarantees they are present regardless of the CMS version.
RUN composer require 'drupal/key' 'drupal/ai' 'drupal/ai_provider_groq:@dev' --no-progress \
    || echo "[WARN] AI/Groq composer require failed — AI features may be limited."

# ── Custom modules & themes ───────────────────────────────────────────────
# Copy before chown so www-data owns everything in one pass.
COPY custom-modules/ /var/www/html/web/modules/custom/
COPY custom-themes/  /var/www/html/web/themes/custom/

# ── Permissions ───────────────────────────────────────────────────────────
RUN chown -R www-data:www-data /var/www/html

# ── Entrypoint ────────────────────────────────────────────────────────────
COPY docker-entrypoint.sh /docker-entrypoint-canvas.sh
RUN chmod +x /docker-entrypoint-canvas.sh

ENTRYPOINT ["/docker-entrypoint-canvas.sh"]
CMD ["apache2-foreground"]
