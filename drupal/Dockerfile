FROM drupal:10-apache

RUN apt-get update && apt-get install -y \
    git \
    unzip \
    curl \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install Drush into the existing Drupal project
RUN composer require drush/drush --no-interaction --no-progress 2>&1 | tail -5
RUN ln -sf /var/www/html/vendor/bin/drush /usr/local/bin/drush

# Copy custom module
COPY custom-modules/ /var/www/html/web/modules/custom/

# Fix permissions on custom modules
RUN chown -R www-data:www-data /var/www/html/web/modules/custom/

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint-canvas.sh
RUN chmod +x /docker-entrypoint-canvas.sh

ENTRYPOINT ["/docker-entrypoint-canvas.sh"]
CMD ["apache2-foreground"]
