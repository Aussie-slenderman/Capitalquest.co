// Light mode fix — runs every 1 second
// Fixes both backgrounds AND text colors when in light mode
setInterval(function(){
  try {
    var store = localStorage.getItem('stockquest-store') || '';
    var isLight = store.indexOf('"appColorMode":"light"') > -1;
    if (!isLight) return;

    // White text → black
    document.querySelectorAll('.r-1gnjku,.r-1ff0s43,.r-jwli3a').forEach(function(el) {
      el.style.setProperty('color', '#0A0E1A', 'important');
    });
    // Dim grey text → darker grey
    document.querySelectorAll('.r-1npgj5g,.r-1s7ct43').forEach(function(el) {
      el.style.setProperty('color', '#374151', 'important');
    });

    // Dark backgrounds → light backgrounds (atomic CSS classes for #111827, #1A2235, #0A0E1A)
    // Find all elements and check their computed background color
    var all = document.querySelectorAll('div');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var bg = window.getComputedStyle(el).backgroundColor;
      // Replace very dark backgrounds with light equivalents
      if (bg === 'rgb(17, 24, 39)' || bg === 'rgb(26, 34, 53)') {
        el.style.setProperty('background-color', '#F3F4F6', 'important');
      } else if (bg === 'rgb(10, 14, 26)') {
        el.style.setProperty('background-color', '#FFFFFF', 'important');
      }
    }
  } catch(e) {}
}, 1000);
