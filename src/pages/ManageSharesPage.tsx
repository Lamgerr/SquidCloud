import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShareManagerContent } from '@/components/MobileShareManager';
import { ChevronLeft } from '@/lib/icon-map';

const ManageSharesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0D1117]">
      {/* Native-feeling header bar */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 bg-[#0D1117] border-b border-[#2D333B]">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-[#161B22] border border-[#2D333B] flex items-center justify-center text-[#E6EDF3] active:bg-[#1C2128] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-[17px] font-semibold text-[#E6EDF3]">Share Manager</h1>
          <p className="text-[11px] text-[#768390] -mt-0.5">Manage all shared links & file requests</p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <MobileShareManagerContent onClose={() => navigate(-1)} />
      </div>
    </div>
  );
};

export default ManageSharesPage;
