// Cached version expired - forcing reload to latest version
(function(){
  if(!sessionStorage.getItem('cq_reloaded_v28')){
    sessionStorage.setItem('cq_reloaded_v28','1');
    window.location.replace(window.location.origin+'/?nocache='+Date.now());
  }
})();
