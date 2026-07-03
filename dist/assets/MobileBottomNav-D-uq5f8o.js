import{ao as m,u as x,e as h,r as l,z as f,_ as b,j as t,B as v,aX as g}from"./index-tm_wbFe3.js";import j from"./UploadButton-DE04xA8-.js";import{F as w}from"./files-DzoZbgDa.js";import{S as y}from"./share-B0ZehLil.js";import{C as N}from"./code-FCF_K5qy.js";import"./popover-GvqaxfXo.js";import"./camera-BbQRIr-f.js";import"./folder-BKxDPfL7.js";const B=()=>{const s=m(),d=x(),r=h(),[i,n]=l.useState(!0),o=l.useRef(0);if(l.useEffect(()=>{r||(n(!0),o.current=0)},[r]),l.useEffect(()=>{if(!r)return;const e=()=>{const a=window.scrollY;Math.abs(a-o.current)>10&&(n(a<o.current||a<100),o.current=a)};return window.addEventListener("scroll",e,{passive:!0}),()=>window.removeEventListener("scroll",e)},[r]),!r)return null;const c=()=>{window.scrollTo({top:0,behavior:"smooth"})},u=e=>{s.pathname===e?c():d(e)},p=[{icon:w,label:"Files",path:"/dashboard",isActive:s.pathname==="/dashboard"&&!s.search.includes("tab=")},{icon:y,label:"Shared",path:"/dashboard?tab=shared",isActive:s.pathname==="/dashboard"&&s.search.includes("tab=shared")},{icon:f,label:"Upload",path:"#upload",isActive:!1,isUpload:!0},{icon:N,label:"API",path:"/developer-api",isActive:s.pathname==="/developer-api"},{icon:b,label:"Settings",path:"/settings/account",isActive:s.pathname.includes("/settings")}];return t.jsxs(t.Fragment,{children:[t.jsx("nav",{className:`
          fixed bottom-0 left-0 right-0 z-50 lg:hidden
          transition-transform duration-300 ease-out
          ${i?"translate-y-0":"translate-y-full"}
        `,style:{paddingBottom:"env(safe-area-inset-bottom, 0px)"},children:t.jsx("div",{className:"mx-3 mb-3 rounded-2xl border border-blue-500/10 bg-card/90 backdrop-blur-xl shadow-lg shadow-blue-900/10",children:t.jsx("div",{className:"flex items-center justify-around py-2 px-1",children:p.map(e=>{const a=e.icon;return e.isUpload?t.jsx("div",{className:"flex-1 flex justify-center",children:t.jsx(j,{variant:"ghost",size:"sm",currentFolder:"",allowFolderUpload:!0,onUploadComplete:()=>{s.pathname==="/dashboard"&&window.location.reload()},children:t.jsxs("div",{className:"flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1.5 rounded-xl transition-colors",children:[t.jsx("div",{className:"flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10",children:t.jsx(a,{className:"w-[18px] h-[18px] text-primary"})}),t.jsx("span",{className:"text-[10px] font-medium text-muted-foreground mt-1",children:e.label})]})})},e.label):t.jsxs("button",{onClick:()=>u(e.path),className:`
                    flex-1 flex flex-col items-center justify-center min-h-[48px] py-1.5
                    transition-all duration-150 rounded-xl
                    ${e.isActive?"bg-primary/8":"active:bg-accent/50"}
                  `,children:[t.jsx("div",{className:`
                      flex items-center justify-center w-9 h-9 rounded-xl transition-colors
                      ${e.isActive?"bg-primary/15":""}
                    `,children:t.jsx(a,{className:`
                        w-[18px] h-[18px] transition-colors
                        ${e.isActive?"text-primary":"text-muted-foreground"}
                      `,strokeWidth:e.isActive?2.25:1.75})}),t.jsx("span",{className:`
                      text-[10px] font-medium mt-1 transition-colors
                      ${e.isActive?"text-primary":"text-muted-foreground"}
                    `,children:e.label})]},e.label)})})})}),t.jsx(v,{variant:"ghost",size:"icon",className:`
          fixed bottom-24 right-4 z-40 h-10 w-10 rounded-xl
          bg-card/90 backdrop-blur-xl border border-blue-500/10 shadow-lg shadow-blue-900/10
          transition-all duration-300 ease-out lg:hidden
          ${i?"translate-y-0 opacity-100":"translate-y-16 opacity-0"}
        `,onClick:c,children:t.jsx(g,{className:"w-4 h-4 text-muted-foreground"})})]})};export{B as default};
