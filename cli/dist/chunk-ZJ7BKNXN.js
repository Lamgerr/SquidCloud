import {c}from'./chunk-5TMR6Y7L.js';import r from'chalk';import m from'clipboardy';async function a(i){let o=await c(`/api/v1/forms/${i}/embed`,{authenticated:true});try{await m.write(o.html);}catch{}console.log(o.html),console.log(r.dim(`
(copied to clipboard)`));}export{a};//# sourceMappingURL=chunk-ZJ7BKNXN.js.map
//# sourceMappingURL=chunk-ZJ7BKNXN.js.map