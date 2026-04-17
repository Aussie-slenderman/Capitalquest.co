// CapitalQuest Light Mode Fix
// React Native Web's atomic CSS overrides inline styles.
// This script runs every 500ms and forces correct colors when light mode is active.

(function(){
  // Dark → Light color mappings
  var bgMap = {
    'rgb(10, 14, 26)':   '#FFFFFF',   // bg.primary
    'rgb(17, 24, 39)':   '#F3F4F6',   // bg.secondary
    'rgb(26, 34, 53)':   '#E5E7EB',   // bg.tertiary
    'rgb(30, 41, 64)':   '#D1D5DB',   // bg.input
  };
  var textMap = {
    'rgb(241, 245, 249)': '#0A0E1A',  // text.primary (white → near-black)
    'rgb(148, 163, 184)': '#374151',  // text.secondary
    'rgb(100, 116, 139)': '#6B7280',  // text.tertiary
    'rgb(0, 179, 230)':   '#0080B3',  // brand.primary
  };
  var borderMap = {
    'rgb(30, 41, 64)':   '#D1D5DB',   // border.default
    'rgb(26, 34, 53)':   '#E5E7EB',   // border.subtle
  };

  function fix() {
    var store = localStorage.getItem('stockquest-store') || '';
    if (store.indexOf('"appColorMode":"light"') === -1) return;

    var root = document.getElementById('root');
    if (!root) return;
    var all = root.getElementsByTagName('*');

    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var cs = window.getComputedStyle(el);

      // Fix background colors
      var bg = cs.backgroundColor;
      if (bgMap[bg]) {
        el.style.setProperty('background-color', bgMap[bg], 'important');
      }

      // Fix text colors
      var tag = el.tagName;
      if (tag === 'SPAN' || tag === 'P' || tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'DIV') {
        var color = cs.color;
        if (textMap[color]) {
          el.style.setProperty('color', textMap[color], 'important');
        }
      }

      // Fix border colors
      var bc = cs.borderTopColor;
      if (borderMap[bc]) {
        el.style.setProperty('border-color', borderMap[bc], 'important');
      }
    }
  }

  setInterval(fix, 500);
})();
