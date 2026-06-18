(function (Drupal, once) {
  'use strict';
  Drupal.behaviors.tibiHeader = {
    attach: function (context) {
      once('tibi-header', '.tibi-header__toggle', context).forEach(function (btn) {
        var menu = document.getElementById(btn.getAttribute('aria-controls'));
        if (!menu) return;
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!open));
          menu.hidden = open;
        });
      });
    }
  };
}(Drupal, once));
