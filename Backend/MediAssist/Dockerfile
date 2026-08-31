FROM php:8.4-fpm

# System dependencies
RUN apt-get update && apt-get install -y \
    git unzip curl libpng-dev libonig-dev libxml2-dev zip libzip-dev libpq-dev \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && docker-php-ext-install pdo pdo_pgsql pgsql mbstring zip exif pcntl gd sockets

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY . .

ENV COMPOSER_PROCESS_TIMEOUT=0
ENV COMPOSER_MAX_PARALLEL_HTTP=2
# Retry: composer caches completed downloads, so a re-run only fetches what a
# flaky connection dropped (e.g. the large google/apiclient-services zip).
RUN for i in 1 2 3 4 5; do \
      composer install --no-dev --optimize-autoloader --no-interaction && break; \
      echo "composer install attempt $i failed, retrying..."; sleep 10; \
    done

RUN php artisan config:clear \
    && php artisan route:clear \
    && php artisan view:clear

CMD ["php-fpm"]
