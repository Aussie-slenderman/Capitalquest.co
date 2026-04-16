// Fix light mode text visibility — runs every 2s
setInterval(function(){
  try {
    // Check if user has light mode enabled in their saved settings
    var store = localStorage.getItem('stockquest-store') || localStorage.getItem('app-storage') || '';
    var isLight = store.indexOf('"appColorMode":"light"') > -1;

    // Also check actual background colors as fallback
    if (!isLight) {
      var root = document.getElementById('root');
      if (root) {
        var els = root.querySelectorAll('[style*="background"]');
        for (var i = 0; i < Math.min(els.length, 10); i++) {
          var bg = els[i].style.backgroundColor;
          if (bg && (bg.indexOf('255') > -1 || bg.indexOf('243') > -1 || bg.indexOf('245') > -1)) {
            isLight = true;
            break;
          }
        }
      }
    }

    if (isLight) {
      // Force white/cyan text to black in light mode
      document.querySelectorAll('.r-1gnjku,.r-1ff0s43,.r-jwli3a').forEach(function(el) {
        el.style.setProperty('color', '#0A0E1A', 'important');
      });
      // Force dim text to dark gray
      document.querySelectorAll('.r-1npgj5g,.r-1s7ct43').forEach(function(el) {
        el.style.setProperty('color', '#374151', 'important');
      });
    }
  } catch(e) {}
}, 2000);
