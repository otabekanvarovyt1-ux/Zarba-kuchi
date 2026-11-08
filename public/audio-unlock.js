/* iPhone'da ovoz chiqishi uchun: o'yin skriptlaridan OLDIN yuklang */
(function(){
  // iOS 17+: ovoz "ring/silent" tugmasiga bo'ysunmasin, media kabi chiqsin
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
  // O'yin yaratgan barcha AudioContext'larni eslab qolamiz
  var ctxs=[],Native=window.AudioContext||window.webkitAudioContext;
  if(Native){
    var Wrapped=function(o){var c=new Native(o);ctxs.push(c);return c};
    Wrapped.prototype=Native.prototype;
    window.AudioContext=Wrapped;window.webkitAudioContext=Wrapped;
  }
  var silent=null,done=false;
  function unlock(){
    // Ovoz o'chirilgan tugma (silent switch) bo'lsa ham chiqishi uchun jim <audio> ni ishga tushiramiz
    try{
      if(!silent){
        silent=document.createElement('audio');
        silent.setAttribute('playsinline','');
        silent.src='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        silent.loop=true;silent.volume=.01;
      }
      silent.play().catch(function(){});
    }catch(e){}
    ctxs.forEach(function(c){
      if(c.state!=='running'){c.resume().catch(function(){})}
      try{var b=c.createBuffer(1,1,22050),s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.start(0)}catch(e){}
    });
    if(ctxs.length&&ctxs.every(function(c){return c.state==='running'})&&!done){
      done=true;
      ['touchstart','touchend','pointerdown','click','keydown'].forEach(function(t){document.removeEventListener(t,unlock,true)});
    }
  }
  ['touchstart','touchend','pointerdown','click','keydown'].forEach(function(t){document.addEventListener(t,unlock,true)});
  // Ekranga qaytganda (boshqa ilovadan) ovoz to'xtab qolmasin
  document.addEventListener('visibilitychange',function(){if(!document.hidden)ctxs.forEach(function(c){c.resume&&c.resume().catch(function(){})})});
})();
