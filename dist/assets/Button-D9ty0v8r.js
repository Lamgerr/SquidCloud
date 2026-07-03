import{P as a,j as g,y as c}from"./index-tm_wbFe3.js";const b=a.forwardRef(({variant:e="primary",size:r="md",className:s,children:t,...i},o)=>{const d=`
      inline-flex items-center justify-center
      font-medium transition-all duration-150
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `,u={primary:`
        bg-squid-blue-600 text-white
        hover:bg-squid-blue-700
        focus:ring-squid-blue-500
        active:bg-squid-blue-800
      `,secondary:`
        bg-squid-gray-100 text-squid-gray-900
        hover:bg-squid-gray-200
        focus:ring-squid-gray-500
        border border-squid-gray-200
      `,ghost:`
        text-squid-gray-700
        hover:bg-squid-gray-100
        focus:ring-squid-gray-500
      `,danger:`
        bg-squid-error text-white
        hover:bg-red-600
        focus:ring-squid-error
      `},n={sm:"px-3 py-1.5 text-sm rounded-md",md:"px-4 py-2 text-sm rounded-md",lg:"px-5 py-2.5 text-base rounded-lg"};return g.jsx("button",{ref:o,className:c(d,u[e],n[r],s),...i,children:t})});b.displayName="Button";export{b as Button};
