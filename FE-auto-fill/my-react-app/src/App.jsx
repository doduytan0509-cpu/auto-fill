import React, { useState, useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import { Navbar } from './components/Navbar';
import { SettingsModal } from './components/SettingsModal';
import { StudioView } from './views/StudioView';
import { FormInspectorView } from './views/FormInspectorView';
import { ExcelViewerView } from './views/ExcelViewerView';
import { JobDashboardView } from './views/JobDashboardView';
import { api } from './api/client';

export function AppContent() {
  const [activeTab, setActiveTab] = useState('studio');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeJobCount, setActiveJobCount] = useState(0);

  // Shared state between views
  const [studioFormUrl, setStudioFormUrl] = useState('');
  const [studioFormData, setStudioFormData] = useState(null);
  const [studioExcelFile, setStudioExcelFile] = useState(null);
  const [selectedJobIdForModal, setSelectedJobIdForModal] = useState(null);

  // Poll for running jobs count to update badge
  const updateJobCount = async () => {
    try {
      const jobs = await api.listJobs();
      const running = (jobs || []).filter((j) => j.status === 'running' || j.status === 'pending');
      setActiveJobCount(running.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    updateJobCount();
    const interval = setInterval(updateJobCount, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUseFormInStudio = (url, data) => {
    setStudioFormUrl(url);
    setStudioFormData(data);
    setActiveTab('studio');
  };

  const handleUseExcelInStudio = (file) => {
    setStudioExcelFile(file);
    setActiveTab('studio');
  };

  const handleJobCreated = (jobId) => {
    setSelectedJobIdForModal(jobId);
    setActiveTab('jobs');
    updateJobCount();
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeJobCount={activeJobCount}
      />

      <main className="main-content">
        {activeTab === 'studio' && (
          <StudioView
            onJobCreated={handleJobCreated}
            initialFormUrl={studioFormUrl}
            initialFormData={studioFormData}
            initialFile={studioExcelFile}
          />
        )}

        {activeTab === 'inspector' && (
          <FormInspectorView onUseFormInStudio={handleUseFormInStudio} />
        )}

        {activeTab === 'excel' && (
          <ExcelViewerView onUseExcelInStudio={handleUseExcelInStudio} />
        )}

        {activeTab === 'jobs' && (
          <JobDashboardView
            onNewJobClick={() => setActiveTab('studio')}
            selectedJobId={selectedJobIdForModal}
            setSelectedJobId={setSelectedJobIdForModal}
          />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onServerUrlChanged={() => updateJobCount()}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
