(()=>{
 const attempts=[];Object.defineProperty(window,'__forbiddenAttempts',{value:attempts});
 const deny=key=>{attempts.push(key);throw new DOMException('Validation denies '+key,'SecurityError');};
 for(const key of ['localStorage','sessionStorage','indexedDB','caches','sharedStorage'])try{Object.defineProperty(window,key,{configurable:true,get:()=>deny(key)});}catch{}
 try{Object.defineProperty(Document.prototype,'cookie',{configurable:true,get:()=>deny('cookie read'),set:()=>deny('cookie write')});}catch{}
 for(const key of ['serviceWorker','clipboard'])try{Object.defineProperty(Navigator.prototype,key,{configurable:true,get:()=>deny(key)});}catch{}
})();
