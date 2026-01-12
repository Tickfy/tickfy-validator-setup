import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { api } from './lib/api';
import DependencySetup from './components/DependencySetup';
import Login from './components/Login';
import Setup from './components/Setup';
import WalletSetup from './components/WalletSetup';
import NodeSetupWizard from './components/NodeSetupWizard';
import Dashboard from './components/Dashboard';

const STEPS = {
  LOADING: 'loading',
  DEPENDENCIES: 'dependencies',
  SETUP: 'setup',
  LOGIN: 'login',
  WALLET: 'wallet',
  NODE_SETUP: 'node_setup',
  DASHBOARD: 'dashboard',
};

function App() {
  const [currentStep, setCurrentStep] = useState(STEPS.LOADING);
  const [nodeStatus, setNodeStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // First check if dependencies are installed
      try {
        const depStatus = await api.getDependenciesStatus();
        if (!depStatus.isNodeInstalled || !depStatus.isCosmovisorInstalled) {
          setCurrentStep(STEPS.DEPENDENCIES);
          return;
        }
      } catch {
        // If can't get status, go to dependencies
        setCurrentStep(STEPS.DEPENDENCIES);
        return;
      }

      const authStatus = await api.getAuthStatus();
      
      if (!authStatus.isSetup) {
        setCurrentStep(STEPS.SETUP);
        return;
      }

      // Check if we have a valid token
      const token = localStorage.getItem('token');
      if (!token) {
        setCurrentStep(STEPS.LOGIN);
        return;
      }

      // Validate token by getting node status
      try {
        const status = await api.getNodeStatus();
        setNodeStatus(status);
        determineStep(status);
      } catch (err) {
        // Token invalid
        api.logout();
        setCurrentStep(STEPS.LOGIN);
      }
    } catch (err) {
      setError(err.message);
      setCurrentStep(STEPS.SETUP);
    }
  };

  const determineStep = (status) => {
    // Always go to Dashboard by default
    setCurrentStep(STEPS.DASHBOARD);
  };

  const handleSetupComplete = async () => {
    try {
      const status = await api.getNodeStatus();
      setNodeStatus(status);
      determineStep(status);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLoginComplete = async () => {
    try {
      const status = await api.getNodeStatus();
      setNodeStatus(status);
      determineStep(status);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStepComplete = async () => {
    try {
      const status = await api.getNodeStatus();
      setNodeStatus(status);
      determineStep(status);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentStep(STEPS.LOGIN);
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  if (currentStep === STEPS.LOADING) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/logo.svg" 
            alt="Tickfy Logo" 
            className="w-16 h-16 mx-auto mb-4 animate-pulse"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/logo.png';
            }}
          />
          <h2 className="text-xl font-bold text-white mb-2">Tickfy Validator</h2>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (currentStep === STEPS.DEPENDENCIES) {
    return <DependencySetup onComplete={() => setCurrentStep(STEPS.SETUP)} />;
  }

  if (currentStep === STEPS.SETUP) {
    return <Setup onComplete={handleSetupComplete} />;
  }

  if (currentStep === STEPS.LOGIN) {
    return <Login onComplete={handleLoginComplete} />;
  }

  // Determine what's completed based on nodeStatus
  const walletCompleted = nodeStatus?.hasWallet || false;
  const nodeSetupCompleted = nodeStatus?.isValidator || false;

  const menuItems = [
    { key: STEPS.DASHBOARD, label: 'Dashboard', description: 'Monitorar seu validador', completed: false },
    { key: STEPS.WALLET, label: 'Carteira', description: walletCompleted ? 'Conectada' : 'Criar ou importar carteira', completed: walletCompleted },
    { key: STEPS.NODE_SETUP, label: 'Setup Node', description: nodeSetupCompleted ? 'Configurado' : 'Configurar node e validador', completed: nodeSetupCompleted },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-700 flex flex-col z-50">
        {/* Logo & Title */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.svg" 
              alt="Tickfy" 
              className="w-10 h-10"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/logo.png';
              }}
            />
            <div>
              <h1 className="font-bold text-white">Tickfy Validator</h1>
              <span className="text-xs text-tickfy-light-400">Web Dashboard</span>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = currentStep === item.key;
              const isCompleted = item.completed;
              
              return (
                <li key={item.key}>
                  <button
                    onClick={() => goToStep(item.key)}
                    className={`w-full flex flex-col items-start px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-tickfy-500/20 border border-tickfy-500/40 text-white'
                        : isCompleted
                        ? 'bg-green-600/10 text-green-400 hover:bg-green-600/20'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center w-full">
                      <span className="text-sm font-medium">{item.label}</span>
                      {isCompleted && !isActive && (
                        <span className="ml-auto text-green-400 text-xs">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 mt-0.5">{item.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1">
        {currentStep === STEPS.WALLET && (
          <WalletSetup nodeStatus={nodeStatus} onComplete={handleStepComplete} />
        )}
        {currentStep === STEPS.NODE_SETUP && (
          <NodeSetupWizard 
            nodeStatus={nodeStatus} 
            onComplete={handleStepComplete}
            onRefresh={handleStepComplete}
          />
        )}
        {currentStep === STEPS.DASHBOARD && (
          <Dashboard nodeStatus={nodeStatus} onRefresh={handleStepComplete} />
        )}
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}
    </div>
  );
}

export default App;
