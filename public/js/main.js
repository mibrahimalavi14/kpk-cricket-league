document.addEventListener('DOMContentLoaded', function() {
  var hamburger = document.querySelector('.hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', function() {
      document.querySelector('.nav-links').classList.toggle('open');
    });
  }
});