import React, { useState, useEffect } from 'react';
import { Package, Download, CheckCircle, Loader2, AlertCircle, HardDrive } from 'lucide-react';
import { api } from '../lib/api';

// ============================================================================
// DEPENDENCY CONFIGURATION
// Fácil de adicionar novas dependências aqui
// ============================================================================
const DEPENDENCIES = [
  {
    id: 'binary',
    name: 'Tickfy Blockchain',
    description: 'Binário principal do node',
    size: 123, // MB
    install: () => api.installDependency('binary'),
    checkInstalled: (status) => status?.isNodeInstalled,
  },
  {
    id: 'cosmovisor',
    name: 'Cosmovisor',
    description: 'Gerenciador de upgrades automáticos',
    size: 15, // MB
    install: () => api.installDependency('cosmovisor'),
    checkInstalled: (status) => status?.isCosmovisorInstalled,
  },
  // Adicione mais dependências aqui conforme necessário
  // {
  //   id: 'exemplo',
  //   name: 'Nome da Dependência',
  //   description: 'Descrição',
  //   size: 10, // MB
  //   install: () => api.installExemplo(),
  //   checkInstalled: (status) => status?.isExemploInstalled,
  // },
];

function DependencySetup({ onComplete }) {
  const [status, setStatus] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [currentDep, setCurrentDep] = useState(null);
  const [installedDeps, setInstalledDeps] = useState({});
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkDependencies();
  }, []);

  const checkDependencies = async () => {
    try {
      const s = await api.getDependenciesStatus();
      setStatus(s);

      // Check which dependencies are already installed
      const installed = {};
      for (const dep of DEPENDENCIES) {
        installed[dep.id] = dep.checkInstalled(s);
      }
      setInstalledDeps(installed);

      // If all installed, auto-continue
      const allInstalled = DEPENDENCIES.every(dep => installed[dep.id]);
      if (allInstalled) {
        onComplete();
      }
    } catch (err) {
      // First run, nothing installed yet
      setInstalledDeps({});
    }
  };

  const getTotalSize = () => {
    return DEPENDENCIES.reduce((total, dep) => {
      if (!installedDeps[dep.id]) {
        return total + dep.size;
      }
      return total;
    }, 0);
  };

  const getPendingDeps = () => {
    return DEPENDENCIES.filter(dep => !installedDeps[dep.id]);
  };

  const handleInstallAll = async () => {
    setIsInstalling(true);
    setError(null);
    setProgress(0);

    const pending = getPendingDeps();
    const totalDeps = pending.length;

    for (let i = 0; i < pending.length; i++) {
      const dep = pending[i];
      setCurrentDep(dep.id);
      
      try {
        await dep.install();
        setInstalledDeps(prev => ({ ...prev, [dep.id]: true }));
        setProgress(Math.round(((i + 1) / totalDeps) * 100));
      } catch (err) {
        setError(`Erro ao instalar ${dep.name}: ${err.message}`);
        setIsInstalling(false);
        setCurrentDep(null);
        return;
      }
    }

    setIsInstalling(false);
    setCurrentDep(null);
    
    // Small delay before continuing
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  const allInstalled = DEPENDENCIES.every(dep => installedDeps[dep.id]);
  const totalSize = getTotalSize();
  const pendingCount = getPendingDeps().length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <img 
            src="/logo.svg" 
            alt="Tickfy Logo" 
            className="w-24 h-24 mx-auto mb-4"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/logo.png';
            }}
          />
          <h2 className="text-2xl font-bold text-white mb-2">Instalar Dependências</h2>
          <p className="text-gray-400">
            Primeiro, vamos baixar tudo que você precisa para rodar um validador
          </p>
        </div>

        {/* Size Estimate */}
        {!allInstalled && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-purple-400" />
              <span className="text-gray-300">Tamanho total estimado</span>
            </div>
            <span className="text-white font-semibold">~{totalSize} MB</span>
          </div>
        )}

        {/* Dependencies List */}
        <div className="space-y-3 mb-6">
          {DEPENDENCIES.map((dep) => {
            const isInstalled = installedDeps[dep.id];
            const isCurrentlyInstalling = currentDep === dep.id;

            return (
              <div
                key={dep.id}
                className={`bg-gray-800/50 border rounded-xl p-4 transition-all ${
                  isInstalled 
                    ? 'border-green-500/50' 
                    : isCurrentlyInstalling 
                      ? 'border-purple-500/50 bg-purple-500/10' 
                      : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isInstalled 
                        ? 'bg-green-600' 
                        : isCurrentlyInstalling 
                          ? 'bg-tickfy-500' 
                          : 'bg-gray-700'
                    }`}>
                      {isInstalled ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : isCurrentlyInstalling ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{dep.name}</h3>
                      <p className="text-sm text-gray-400">{dep.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isInstalled ? (
                      <span className="text-green-400 text-sm">Instalado</span>
                    ) : isCurrentlyInstalling ? (
                      <span className="text-purple-400 text-sm">Instalando...</span>
                    ) : (
                      <span className="text-gray-500 text-sm">~{dep.size} MB</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        {isInstalling && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Progresso</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-tickfy-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        )}

        {/* Install Button */}
        {!allInstalled && (
          <button
            onClick={handleInstallAll}
            disabled={isInstalling}
            className="w-full py-4 bg-tickfy-500 hover:bg-tickfy-600 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Instalando {pendingCount} dependência{pendingCount > 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Instalar Tudo ({totalSize} MB)
              </>
            )}
          </button>
        )}

        {/* All Installed */}
        {allInstalled && (
          <div className="text-center">
            <div className="text-green-400 mb-4">
              ✓ Todas as dependências instaladas!
            </div>
            <button
              onClick={onComplete}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* Skip option for development */}
        {!isInstalling && !allInstalled && (
          <button
            onClick={onComplete}
            className="w-full mt-4 py-2 text-gray-500 hover:text-gray-400 text-sm transition"
          >
            Pular (já tenho instalado manualmente)
          </button>
        )}
      </div>
    </div>
  );
}

export default DependencySetup;
