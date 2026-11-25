import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShareManagerContent } from '@/components/MobileShareManager';
import { ChevronLeft } from '@/lib/icon-map';

const MS_CSS = `
.ms-root{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;
  background:var(--sa-bg,#090b0a);color:var(--sa-text,#e8e7e1)}
.ms-head{display:flex;align-items:center;gap:12px;padding:44px 20px 14px;
  border-bottom:1px solid var(--sa-line,#1f2221)}
.ms-back{display:grid;place-items:center;width:36px;height:36px;flex:none;
  border:1px solid var(--sa-line,#1f2221);border-radius:10px;
  background:var(--sa-bg-2,#0e1110);color:var(--sa-text,#e8e7e1);cursor:pointer}
.ms-back:hover{background:var(--sa-bg-3,#141816)}
.ms-back svg{width:18px;height:18px}
.ms-title{margin:0;font-size:15px;font-weight:400;letter-spacing:-.02em;color:var(--sa-text,#e8e7e1)}
.ms-sub{margin:2px 0 0;font-size:11px;color:var(--sa-mute,#8d8f89)}
.ms-body{flex:1;min-height:0;overflow:hidden}
`;

const ManageSharesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="ms-root">
      <style>{MS_CSS}</style>
      <div className="ms-head">
        <button
          onClick={() => navigate(-1)}
          className="ms-back"
          aria-label="Back"
        >
          <ChevronLeft />
        </button>
        <div>
          <h1 className="ms-title">Share Manager</h1>
          <p className="ms-sub">Manage all shared links &amp; file requests</p>
        </div>
      </div>
      <div className="ms-body">
        <MobileShareManagerContent onClose={() => navigate(-1)} />
      </div>
    </div>
  );
};

export default ManageSharesPage;
