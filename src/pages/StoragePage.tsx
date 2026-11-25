import React from 'react';
import { PageFrame } from '@/components/layout/PageFrame';
import { useAuth } from '@/contexts/AuthContext';
import StorageTab from '@/components/StorageTab';
import { Navigate } from 'react-router-dom';

const StoragePage = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <PageFrame title="Storage Management" subtitle="Browse and manage everything you keep in SquidCloud." wide>
      <StorageTab />
    </PageFrame>
  );
};

export default StoragePage;
