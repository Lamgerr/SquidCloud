import{r,a as ee,s as g,j as e,k as v,B as f,a6 as ae,L as j,I as N,E as K,g as L,F as R,V as D,i as C,f as te}from"./index-tm_wbFe3.js";import{Card as se,CardContent as re}from"./card-qDXzpdj3.js";const oe=({userId:x,onVaultOpen:k,onClose:S})=>{const[P,A]=r.useState(!0),[m,b]=r.useState(!0),[F,V]=r.useState(null),[i,d]=r.useState(!1),[z,y]=r.useState(!1),[p,H]=r.useState(""),[c,E]=r.useState(""),[q,W]=r.useState(""),[u,I]=r.useState(!1),[l,O]=r.useState(!1),[M,ie]=r.useState(!1),[$,Y]=r.useState(null),[o,_]=r.useState(!1),{toast:s}=ee();r.useEffect(()=>{G(),X()},[x]),r.useEffect(()=>{if(!m&&o&&l&&P){const a=setTimeout(()=>{B()},500);return()=>clearTimeout(a)}},[m,o,l,P]);const G=async()=>{try{const{data:a,error:t}=await g.from("vaults").select("*").eq("user_id",x).single();a&&!t?(V(a),b(!1),a.passkey_credential_id&&(_(!0),Y(a.passkey_credential_id))):b(!0)}catch(a){console.error("Error checking vault:",a),b(!0)}},X=async()=>{if(window.PublicKeyCredential)try{const a=await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();O(a)}catch(a){console.error("Fingerprint check failed:",a),O(!1)}},J=async a=>{try{if(!l)return null;const t=new Uint8Array(32);crypto.getRandomValues(t);const n={challenge:t,rp:{name:"CloudBliss SquidVault",id:window.location.hostname},user:{id:new TextEncoder().encode(x),name:p,displayName:p},pubKeyCredParams:[{alg:-7,type:"public-key"},{alg:-257,type:"public-key"}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required"},timeout:6e4,attestation:"none"},w=await navigator.credentials.create({publicKey:n});if(w){const h=btoa(String.fromCharCode(...new Uint8Array(w.rawId)));return await g.from("vaults").update({passkey_credential_id:h}).eq("id",a),h}}catch(t){t.name!=="NotAllowedError"&&s({title:"Passkey setup failed",description:"You can still use password authentication"})}return null},Q=async()=>{if(!p.trim()){s({title:"Vault name required",description:"Please enter a name for your vault",variant:"destructive"});return}if(!c){s({title:"Password required",description:"Please enter a password for your vault",variant:"destructive"});return}if(c!==q){s({title:"Passwords don't match",description:"Please make sure both passwords match",variant:"destructive"});return}if(c.length<8){s({title:"Password too short",description:"Password must be at least 8 characters long",variant:"destructive"});return}d(!0);try{const{data:a,error:t}=await g.from("vaults").insert({user_id:x,name:p.trim(),password_hash:await U(c)}).select().single();if(t)throw t;if(V(a),b(!1),l){s({title:"Setting up biometric...",description:"Please scan your fingerprint or use Face ID"});const n=await J(a.id);n&&(Y(n),_(!0),s({title:"Biometric setup complete! ✓",description:"You can now use fingerprint to unlock your vault"}))}y(!0),s({title:"Vault created successfully! 🎉",description:`Welcome to ${p}`}),setTimeout(()=>{k()},2e3)}catch(a){s({title:"Failed to create vault",description:a.message||"Something went wrong",variant:"destructive"})}finally{d(!1)}},T=async()=>{if(!c&&!M){s({title:"Password required",description:"Please enter your vault password",variant:"destructive"});return}d(!0);try{const{data:a,error:t}=await g.from("vaults").select("password_hash").eq("user_id",x).single();if(t)throw t;if(!await Z(c,a.password_hash||"")){s({title:"Invalid password",description:"The password you entered is incorrect",variant:"destructive"}),d(!1);return}y(!0),setTimeout(()=>{A(!1),k(),y(!1)},1500)}catch(a){s({title:"Failed to open vault",description:a.message||"Something went wrong",variant:"destructive"})}finally{d(!1)}},B=async()=>{try{if(!l||!o){s({title:"Biometric unavailable",description:o?"Your device doesn't support biometric authentication":"Please set up passkey first",variant:"destructive"});return}d(!0),s({title:"Biometric authentication",description:"Place your finger on the sensor or use Face ID"});const a=new Uint8Array(32);crypto.getRandomValues(a);const t=Uint8Array.from(atob($||""),h=>h.charCodeAt(0)),n={challenge:a,allowCredentials:[{id:t,type:"public-key",transports:["internal"]}],timeout:6e4,userVerification:"required"};await navigator.credentials.get({publicKey:n})&&(y(!0),s({title:"Authentication successful! ✓",description:"Opening your vault..."}),setTimeout(()=>{A(!1),k(),y(!1)},1500))}catch(a){a.name==="NotAllowedError"?s({title:"Authentication cancelled",description:"Biometric authentication was cancelled",variant:"destructive"}):s({title:"Authentication failed",description:"Please try again or use password",variant:"destructive"})}finally{d(!1)}},U=async a=>{const n=new TextEncoder().encode(a),w=await crypto.subtle.digest("SHA-256",n);return Array.from(new Uint8Array(w)).map(h=>h.toString(16).padStart(2,"0")).join("")},Z=async(a,t)=>await U(a)===t;return e.jsxs(e.Fragment,{children:[z&&e.jsxs("div",{className:"fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none overflow-hidden",children:[e.jsxs("div",{className:"absolute inset-0",style:{animation:"orbAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",willChange:"opacity"},children:[e.jsx("div",{className:"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-0",style:{background:"radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)",animation:"orbPulse 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards",filter:"blur(40px)",willChange:"transform, opacity",transform:"translate3d(-50%, -50%, 0)"}}),e.jsx("div",{className:"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-0",style:{background:"radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%)",animation:"orbPulse 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards",filter:"blur(60px)",willChange:"transform, opacity",transform:"translate3d(-50%, -50%, 0)"}}),e.jsx("div",{className:"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-0",style:{background:"radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, transparent 70%)",animation:"orbPulse 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards",filter:"blur(50px)",willChange:"transform, opacity",transform:"translate3d(-50%, -50%, 0)"}})]}),e.jsxs("div",{className:"relative z-10 flex flex-col items-center opacity-0",style:{animation:"contentFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards",willChange:"opacity"},children:[e.jsxs("div",{className:"relative mb-6",style:{animation:"iconScale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards",transform:"scale3d(0, 0, 1)",willChange:"transform"},children:[e.jsx(v,{className:"w-24 h-24 text-white drop-shadow-lg"}),e.jsx("div",{className:"absolute inset-0 -z-10",style:{background:"radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%)",filter:"blur(20px)",animation:"glowPulse 2s ease-in-out infinite",willChange:"opacity"}})]}),e.jsxs("div",{className:"text-center text-white opacity-0",style:{animation:"textSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards",willChange:"transform, opacity"},children:[e.jsx("h2",{className:"text-4xl font-semibold mb-2 tracking-tight",children:m?"Welcome to SquidVault":"Opening SquidVault"}),e.jsx("p",{className:"text-lg opacity-80 font-light",children:m?"Your secure private space":F?.name})]}),e.jsx("div",{className:"flex gap-1.5 mt-8 opacity-0",style:{animation:"waveAppear 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards"},children:[...Array(5)].map((a,t)=>e.jsx("div",{className:"w-1 h-4 bg-white/60 rounded-full",style:{animation:`waveBar 1.2s cubic-bezier(0.45, 0, 0.55, 1) ${t*.08}s infinite`}},t))})]}),e.jsx("div",{className:"absolute inset-0 backdrop-blur-3xl -z-10",style:{animation:"backdropFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",backgroundColor:"rgba(0, 0, 0, 0.4)"}})]}),P&&!z&&e.jsx("div",{className:"w-full h-full",children:e.jsx(se,{className:"w-full shadow-2xl border-2 border-blue-500/20",style:{animation:"modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"},children:e.jsxs(re,{className:"p-4 sm:p-6",children:[e.jsxs("div",{className:"flex justify-between items-center mb-4 sm:mb-6",children:[e.jsxs("div",{className:"flex items-center gap-2 sm:gap-3",children:[e.jsx(v,{className:"w-6 h-6 sm:w-8 sm:h-8 text-blue-500"}),e.jsx("h2",{className:"text-xl sm:text-2xl font-bold",children:m?"Create SquidVault":"Open SquidVault"})]}),S&&e.jsx(f,{variant:"ghost",size:"sm",className:"h-8 w-8 p-0 rounded-full hover:bg-red-500/10",onClick:S,children:e.jsx(ae,{className:"w-4 h-4 text-muted-foreground hover:text-red-500"})})]}),e.jsx("div",{className:"space-y-4",children:m?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(j,{htmlFor:"vaultName",children:"Vault Name"}),e.jsx(N,{id:"vaultName",placeholder:"My Private Vault",value:p,onChange:a=>H(a.target.value),disabled:i})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(j,{htmlFor:"password",children:"Password"}),e.jsxs("div",{className:"relative",children:[e.jsx(N,{id:"password",type:u?"text":"password",placeholder:"Enter a strong password",value:c,onChange:a=>E(a.target.value),disabled:i}),e.jsx(f,{type:"button",variant:"ghost",size:"sm",className:"absolute right-0 top-0 h-full px-3",onClick:()=>I(!u),children:u?e.jsx(K,{className:"w-4 h-4"}):e.jsx(L,{className:"w-4 h-4"})})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(j,{htmlFor:"confirmPassword",children:"Confirm Password"}),e.jsx(N,{id:"confirmPassword",type:u?"text":"password",placeholder:"Re-enter your password",value:q,onChange:a=>W(a.target.value),disabled:i})]}),l&&e.jsxs("div",{className:"flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg",children:[e.jsx(R,{className:"w-5 h-5 text-blue-500"}),e.jsxs("div",{className:"flex-1",children:[e.jsx("p",{className:"text-sm font-medium",children:"Fingerprint Available"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"You can use fingerprint for faster access"})]}),e.jsx(D,{className:"w-5 h-5 text-blue-500"})]}),e.jsx(f,{onClick:Q,disabled:i,className:"w-full",children:i?e.jsxs(e.Fragment,{children:[e.jsx(C,{className:"w-4 h-4 mr-2 animate-spin"}),"Creating..."]}):e.jsxs(e.Fragment,{children:[e.jsx(v,{className:"w-4 h-4 mr-2"}),"Create Vault"]})})]}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"text-center py-4",children:[e.jsx(v,{className:"w-16 h-16 mx-auto mb-4 text-blue-500"}),e.jsx("h3",{className:"text-xl font-semibold mb-2",children:F?.name}),e.jsx("p",{className:"text-sm text-muted-foreground",children:o&&l?"Use passkey or enter password":"Enter your password to access"}),o&&l&&e.jsxs("div",{className:"mt-2 flex items-center justify-center gap-2 text-xs text-green-600 dark:text-green-400",children:[e.jsx(D,{className:"w-3 h-3"}),e.jsx("span",{children:"Passkey enabled"})]})]}),o&&l&&e.jsxs("div",{className:"space-y-3",children:[e.jsx(f,{onClick:B,disabled:i,className:"w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white",size:"lg",children:i?e.jsxs(e.Fragment,{children:[e.jsx(C,{className:"w-5 h-5 mr-2 animate-spin"}),"Authenticating..."]}):e.jsxs(e.Fragment,{children:[e.jsx(R,{className:"w-5 h-5 mr-2"}),"Sign in with Passkey"]})}),e.jsxs("div",{className:"relative",children:[e.jsx("div",{className:"absolute inset-0 flex items-center",children:e.jsx("span",{className:"w-full border-t"})}),e.jsx("div",{className:"relative flex justify-center text-xs uppercase",children:e.jsx("span",{className:"bg-background px-2 text-muted-foreground",children:"Or use password"})})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(j,{htmlFor:"password",children:"Password"}),e.jsxs("div",{className:"relative",children:[e.jsx(N,{id:"password",type:u?"text":"password",placeholder:"Enter your vault password",value:c,onChange:a=>E(a.target.value),disabled:i,onKeyPress:a=>a.key==="Enter"&&T()}),e.jsx(f,{type:"button",variant:"ghost",size:"sm",className:"absolute right-0 top-0 h-full px-3",onClick:()=>I(!u),children:u?e.jsx(K,{className:"w-4 h-4"}):e.jsx(L,{className:"w-4 h-4"})})]})]}),e.jsx(f,{onClick:T,disabled:i,className:"w-full",variant:o?"outline":"default",children:i?e.jsxs(e.Fragment,{children:[e.jsx(C,{className:"w-4 h-4 mr-2 animate-spin"}),"Opening..."]}):e.jsxs(e.Fragment,{children:[e.jsx(te,{className:"w-4 h-4 mr-2"}),o?"Open with Password":"Open Vault"]})})]})})]})})}),e.jsx("style",{children:`
        /* Orb appear animation */
        @keyframes orbAppear {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Orb pulse animation */
        @keyframes orbPulse {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        /* Content fade in */
        @keyframes contentFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        /* Icon scale with spring */
        @keyframes iconScale {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          60% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Text slide up */
        @keyframes textSlideUp {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Wave appear */
        @keyframes waveAppear {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Wave bar animation - smooth and subtle */
        @keyframes waveBar {
          0%, 100% {
            transform: scaleY(1);
            opacity: 0.6;
          }
          50% {
            transform: scaleY(2.5);
            opacity: 1;
          }
        }

        /* Glow pulse */
        @keyframes glowPulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        /* Backdrop fade */
        @keyframes backdropFade {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        /* Modal slide in - Apple style */
        @keyframes modalSlideIn {
          0% {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `})]})};export{oe as default};
