import {s,g}from'./chunk-BC3STHFS.js';import n from'fs';import o from'path';import m from'inquirer';async function p(){let e=await m.prompt([{type:"input",name:"name",message:"Pipeline name:",validate:a=>a.length>0},{type:"input",name:"description",message:"Description:",default:""},{type:"list",name:"trigger",message:"Trigger type:",choices:["manual","schedule","file_change","webhook"],default:"manual"}]),r=`# ${e.name}
# ${e.description||"SquidScript pipeline"}

name: ${e.name}
description: ${e.description||""}
trigger: ${e.trigger}

steps:
  - name: example-step
    action: log
    params:
      message: "Hello from SquidScript!"
`,s$1=o.join(process.cwd(),".squid.yml");n.writeFileSync(s$1,r,"utf-8"),s(`Created ${g(".squid.yml")} \u2014 run \`squidcloud scripts validate\` to check it`);}export{p as a};//# sourceMappingURL=chunk-NQAQKZPN.js.map
//# sourceMappingURL=chunk-NQAQKZPN.js.map