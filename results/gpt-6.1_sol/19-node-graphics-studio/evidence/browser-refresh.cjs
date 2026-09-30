// Python's development server uses second-granularity Last-Modified; disable the
// browser cache during rapid edits so every verification runs the delivered source.
const h=require('./browser-helper.cjs');
(async()=>{const d=await h.cdp();try{await d.send('Network.enable',{});await d.send('Network.setCacheDisabled',{cacheDisabled:true});await d.send('Page.reload',{ignoreCache:true});h.cmd('wait','--fn','window.studio&&studio.diagnostics().renders>0');console.log('PASS Browser HTTP cache disabled and source reloaded.');}finally{d.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
