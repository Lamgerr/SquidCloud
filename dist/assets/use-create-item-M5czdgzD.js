import{b as v,a as C,r as e,a1 as D,ar as H,bq as M,bt as T}from"./index-tm_wbFe3.js";import{C as i}from"./code-FCF_K5qy.js";import{D as k}from"./database-BEJvWWYu.js";const J=({currentPath:m="",onItemCreated:p}={})=>{const{user:A}=v(),{toast:n}=C(),[w,s]=e.useState(!1),[o,r]=e.useState(""),[c,u]=e.useState(""),[N,f]=e.useState(!1),[l,b]=e.useState("file"),g=e.useMemo(()=>[{name:"Text File",extension:".txt",icon:D,editor:"text"},{name:"Document",extension:".docx",icon:H,editor:"document"},{name:"JavaScript",extension:".js",icon:i,editor:"cbcode"},{name:"TypeScript",extension:".ts",icon:i,editor:"cbcode"},{name:"Python",extension:".py",icon:i,editor:"cbcode"},{name:"HTML",extension:".html",icon:i,editor:"cbcode"},{name:"CSS",extension:".css",icon:i,editor:"cbcode"},{name:"JSON",extension:".json",icon:k,editor:"cbcode"}],[]),h=e.useCallback(()=>{b("folder"),u(""),r("New Folder"),s(!0)},[]),y=e.useCallback(a=>{b("file"),u(a.extension),r(`untitled${a.extension}`),s(!0)},[]),F=e.useCallback(()=>{s(!1),r(""),u(""),f(!1)},[]),x=e.useCallback(async()=>{if(!o.trim()){n({title:"Name required",description:"Please provide a name before continuing.",variant:"destructive"});return}if(!A){n({title:"Authentication required",description:"You need to be signed in to create files or folders.",variant:"destructive"});return}f(!0);try{if(l==="folder")await M(o.trim(),m||""),n({title:"Folder created",description:`${o} created successfully ✅`});else{const a=o.endsWith(c)?o:`${o}${c}`;let t="";switch(c){case".js":t=`// New JavaScript file
console.log("Hello World!");`;break;case".ts":t=`// New TypeScript file
console.log("Hello World!");`;break;case".py":t=`# New Python file
print("Hello World!")`;break;case".html":t=`<!DOCTYPE html>
<html>
<head>
    <title>New Document</title>
</head>
<body>
    <h1>Hello World!</h1>
</body>
</html>`;break;case".css":t=`/* New CSS file */
body {
    margin: 0;
    padding: 0;
}`;break;case".json":t=`{
    "name": "new-file",
    "version": "1.0.0"
}`;break;case".docx":t=`New document

Start writing here...`;break;default:t=`New file

Start writing here...`}const S=new window.File([t],a,{type:"text/plain",lastModified:Date.now()});await T(S,m||"",()=>{});try{const d=new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMfCj2a2+/EeB0FMIzS9N2QQAoUXrTp66hVFApGn+DyvmMfCj2a2+/EeB0FLIHg8tsJNgcYZbrk6qNTDAl6mdLH8dmJPgcZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMfCj2a2+/EeB0FLIHg8tsJNgcYZbrk6qNTDAl6mdLH8dmJPgcZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMfCj2a2+/EeB0F");d.volume=.3,d.play().catch(()=>{})}catch(d){console.warn("Audio playback failed",d)}n({title:"File created",description:`${a} created successfully ✅`})}p?.(),F()}catch(a){console.error("Failed to create item:",a),n({title:"Creation failed",description:`Failed to create ${l}. Please try again.`,variant:"destructive"}),f(!1)}},[l,m,o,c,p,F,n,A]);return{fileTypes:g,dialogOpen:w,setDialogOpen:s,fileName:o,setFileName:r,createMode:l,creating:N,openFileDialog:y,openFolderDialog:h,submit:x}};export{J as u};
