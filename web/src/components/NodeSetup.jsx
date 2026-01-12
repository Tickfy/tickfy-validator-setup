import React, { useState, useEffect } from 'react';
import { Server, Settings, ArrowLeft, Loader2, CheckCircle, Shield, Zap } from 'lucide-react';
import { api } from '../lib/api';

function NodeSetup({ onComplete, onBack }) {
  const [status, setStatus] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [moniker, setMoniker] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const s = await api.getNodeStatus();
      setStatus(s);
      
      // If already initialized, go to next step
      if (s.isNodeInitialized) {
        onComplete();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInit = async () => {
    if (!moniker.trim()) {
      setError('Digite um nome para o validador (moniker)');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      await api.initNode(moniker.trim());
      await loadStatus();
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <button
          onClick={onBack}
          className="mb-6 text-gray-400 hover:text-white flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center">
            <Server className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Inicializar Node</h2>
          <p className="text-gray-400">
            Configure seu node para conectar à rede Tickfy
          </p>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-800/50 border border-green-500/50 rounded-lg p-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-white text-sm font-medium">Binário</p>
              <p className="text-green-400 text-xs">Instalado</p>
            </div>
          </div>
          <div className="bg-gray-800/50 border border-green-500/50 rounded-lg p-3 flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-white text-sm font-medium">Cosmovisor</p>
              <p className="text-green-400 text-xs">Auto-upgrade</p>
            </div>
          </div>
        </div>

        {/* Init Form */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-tickfy-500 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Configurar Identidade</h3>
              <p className="text-sm text-gray-400">Defina o nome público do seu validador</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 mb-1 block text-sm">Nome do Validador (Moniker)</label>
              <input
                type="text"
                value={moniker}
                onChange={(e) => setMoniker(e.target.value)}
                placeholder="Ex: meu-validador-tickfy"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Este nome será visível publicamente na rede
              </p>
            </div>

            {/* What will happen */}
            <div className="bg-gray-700/30 rounded-lg p-4 space-y-2">
              <p className="text-gray-300 text-sm font-medium mb-2">O que será configurado:</p>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>Gerar chaves do validador</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>Baixar genesis.json da rede</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>Configurar peers e seeds</span>
              </div>
            </div>

            <button
              onClick={handleInit}
              disabled={isInitializing || !moniker.trim()}
              className="w-full py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isInitializing && <Loader2 className="w-4 h-4 animate-spin" />}
              {isInitializing ? 'Inicializando...' : 'Inicializar Node'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default NodeSetup;
