const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/ui-v2-claim-line-share.js'),'utf8');
function setup({loggedIn=true,available=true,uploadError=null}={}){
 const calls=[],stored=new Map(),elements=[];
 const sdk={init:async()=>calls.push('init'),isLoggedIn:()=>loggedIn,isInClient:()=>false,isApiAvailable:()=>available,getAccessToken:()=>'test-token',login:o=>calls.push(['login',o]),shareTargetPicker:async(messages)=>{calls.push(['picker',messages]);return {status:'success'}}};
 const document={readyState:'loading',addEventListener(){},getElementById:()=>null,createElement(tag){const e={tag,style:{},handlers:{},setAttribute(){},append(){},addEventListener(n,f){this.handlers[n]=f},showModal(){},remove(){}};elements.push(e);return e},body:{appendChild(){}}};
 const context={window:{liff:sdk},document,location:{origin:'https://divergent-image-qc.vercel.app',search:'',assign:url=>calls.push(['assign',url])},URL,URLSearchParams,console,Date,sessionStorage:{setItem:(k,v)=>stored.set(k,v),getItem:k=>stored.get(k),removeItem:k=>stored.delete(k)},fetch:async(url,options)=>{calls.push(['upload',JSON.parse(options.body)]);return {ok:!uploadError,json:async()=>uploadError?{error:uploadError}:{ok:true,url:'https://neauzvqroaszvqffahkv.supabase.co/storage/v1/object/sign/report-pdfs/test.pdf?token=test'}}}};
 vm.createContext(context);
 vm.runInContext(source.replace(/\}\)\(\);\s*$/,`pendingStore=async(action,value)=>{if(action==='put')globalThis.testPending=value;if(action==='get')return globalThis.testPending;};pdfBase64=async()=> 'JVBERi0=';globalThis.api={preparePdfLine,showPdfActions,loginReturnUrl,LIFF_V2_URL};})();`),context);
 return {api:context.api,context,calls,elements};
}
const out=()=>({blob:{size:200},name:'claim.pdf',label:'สิงหาคม',createdAt:Date.now()});
test('upload PDF then wait for a user click before the recipient picker',async()=>{
 const x=setup();x.api.showPdfActions(out());await new Promise(setImmediate);
 assert.equal(x.calls.filter(c=>c[0]==='upload').length,1);
 assert.equal(x.calls.filter(c=>c[0]==='picker').length,0);
 const share=x.elements.find(e=>e.textContent==='เลือกเพื่อนหรือกลุ่มใน LINE');assert.ok(share);
 await share.handlers.click();const messages=x.calls.find(c=>c[0]==='picker')[1];
 assert.equal(messages[0].type,'text');assert.match(messages[0].text,/\/storage\/v1\/object\/sign\/report-pdfs\//);
 assert.equal(x.calls.find(c=>c[0]==='upload')[1].report_type,'claim');
});
test('login saves the exact PDF and returns to V2 without duplicated paths',async()=>{
 const x=setup({loggedIn:false}),pdf=out();await x.api.preparePdfLine(pdf,{});
 assert.equal(x.context.testPending,pdf);assert.equal(x.calls.filter(c=>c[0]==='upload').length,0);
 assert.equal(new URL(x.calls.find(c=>c[0]==='login')[1].redirectUri).pathname,'/ui-v2-preview');
 assert.equal(new URL(x.api.LIFF_V2_URL).pathname,'/2011407195-ZXPgFEKe');
});
test('unavailable picker stops before uploading',async()=>{
 const x=setup({available:false});await assert.rejects(x.api.preparePdfLine(out(),{}));assert.equal(x.calls.filter(c=>c[0]==='upload').length,0);
});
test('unlinked LINE shows an error and never opens the picker',async()=>{
 const x=setup({uploadError:'LINE_NOT_LINKED'});x.api.showPdfActions(out());await new Promise(setImmediate);
 assert.ok(x.elements.some(e=>String(e.textContent).includes('ยังไม่ได้ผูก')));assert.equal(x.calls.filter(c=>c[0]==='picker').length,0);
});
test('retry uses the uploaded PDF instead of creating another upload',async()=>{
 const x=setup(),pdf=out();await x.api.preparePdfLine(pdf,{});await x.api.preparePdfLine(pdf,{});assert.equal(x.calls.filter(c=>c[0]==='upload').length,1);
});


