(function (Drupal, once) {
  'use strict';

  Drupal.behaviors.tibiCarousel = {
    attach: function (context) {
      once('tibi-carousel', '.tibi-carousel', context).forEach(function (el) {
        var slides  = Array.from(el.querySelectorAll('.tibi-carousel__slide'));
        var dots    = Array.from(el.querySelectorAll('.tibi-carousel__dot'));
        var prev    = el.querySelector('.tibi-carousel__arrow--prev');
        var next    = el.querySelector('.tibi-carousel__arrow--next');
        var autoMs  = parseInt(el.dataset.autoplay, 10) || 5000;
        var current = 0;
        var timer;

        function goTo(index) {
          slides[current].classList.remove('tibi-carousel__slide--active');
          slides[current].setAttribute('aria-hidden', 'true');
          dots[current].classList.remove('tibi-carousel__dot--active');
          dots[current].setAttribute('aria-selected', 'false');
          current = (index + slides.length) % slides.length;
          slides[current].classList.add('tibi-carousel__slide--active');
          slides[current].setAttribute('aria-hidden', 'false');
          dots[current].classList.add('tibi-carousel__dot--active');
          dots[current].setAttribute('aria-selected', 'true');
        }

        function startAuto() {
          timer = setInterval(function () { goTo(current + 1); }, autoMs);
        }

        function resetAuto() {
          clearInterval(timer);
          startAuto();
        }

        prev.addEventListener('click', function () { goTo(current - 1); resetAuto(); });
        next.addEventListener('click', function () { goTo(current + 1); resetAuto(); });
        dots.forEach(function (dot, i) {
          dot.addEventListener('click', function () { goTo(i); resetAuto(); });
        });

        startAuto();
      });
    }
  };
}(Drupal, once));
