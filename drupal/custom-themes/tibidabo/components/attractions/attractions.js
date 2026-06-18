(function (Drupal, once) {
  'use strict';

  Drupal.behaviors.tibiAttractions = {
    attach: function (context) {
      once('tibi-attractions', '.tibi-attractions', context).forEach(function (section) {
        var tabs   = Array.from(section.querySelectorAll('[role="tab"]'));
        var panels = Array.from(section.querySelectorAll('[role="tabpanel"]'));

        tabs.forEach(function (tab) {
          tab.addEventListener('click', function () {
            var target = tab.dataset.tab;

            tabs.forEach(function (t) {
              var active = t.dataset.tab === target;
              t.setAttribute('aria-selected', String(active));
              t.classList.toggle('tibi-chip--active', active);
            });

            panels.forEach(function (p) {
              p.classList.toggle('tibi-attractions__panel--hidden', p.id !== 'tibi-tab-panel-' + target);
            });
          });
        });
      });
    }
  };
}(Drupal, once));
