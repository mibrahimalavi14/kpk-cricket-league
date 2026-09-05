document.addEventListener('DOMContentLoaded', function() {
  var hamburger = document.querySelector('.hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', function() {
      document.querySelector('.nav-links').classList.toggle('open');
    });
  }

  /* Bulletproof sticky season tabs */
  var tabs = document.querySelector('.season-tabs');
  if (tabs) {
    var nav = document.querySelector('.navbar');
    var offset = nav ? nav.offsetHeight + 1 : 68;
    var initialTop = tabs.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop);
    var fixed = false;
    var spacer = null;

    function updateOffset() {
      offset = nav ? nav.offsetHeight + 1 : 68;
    }

    function update() {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      if (!fixed && scrollY > initialTop - offset) {
        fixed = true;
        spacer = document.createElement('div');
        spacer.style.height = tabs.offsetHeight + 'px';
        tabs.parentNode.insertBefore(spacer, tabs);
        tabs.style.position = 'fixed';
        tabs.style.top = offset + 'px';
        tabs.style.left = '0';
        tabs.style.right = '0';
        tabs.style.zIndex = '900';
        tabs.style.margin = '0';
        tabs.style.width = '100%';
      } else if (fixed && scrollY <= initialTop - offset) {
        fixed = false;
        tabs.style.position = '';
        tabs.style.top = '';
        tabs.style.left = '';
        tabs.style.right = '';
        tabs.style.zIndex = '';
        tabs.style.margin = '';
        tabs.style.width = '';
        if (spacer) { spacer.remove(); spacer = null; }
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', function() { updateOffset(); update(); }, { passive: true });
    update();
  }
});