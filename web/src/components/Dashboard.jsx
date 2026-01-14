import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Power, RefreshCw, Coins, TrendingUp, Clock, 
  Server, Users, Box, Play, Square, Terminal, Download,
  AlertTriangle, Wallet, Settings, Trash2, Lock, ChevronRight, TrendingUp as Stake
} from 'lucide-react';
import { api } from '../lib/api';
import ConfirmModal from './ConfirmModal';

function Dashboard({ nodeStatus: initialStatus, onRefresh, goToStep }) {
  const [status, setStatus] = useState(initialStatus);
  const [balance, setBalance] = useState(null);
  const [staking, setStaking] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState({});
  const [error, setError] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showRestakeModal, setShowRestakeModal] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    loadData();
    loadLogs();
    const dataInterval = setInterval(loadData, 5000); // Refresh data every 5s
    const logsInterval = setInterval(loadLogs, 5000); // Refresh logs every 5s
    return () => {
      clearInterval(dataInterval);
      clearInterval(logsInterval);
    };
  }, []);

  const loadData = async () => {
    try {
      const [s, b, st] = await Promise.all([
        api.getNodeStatus(),
        api.getBalance(),
        api.getStakingInfo().catch(() => null),
      ]);
      setStatus(s);
      setBalance(b);
      setStaking(st);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLogs = async () => {
    try {
      const result = await api.getLogs();
      setLogs(result.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleStartNode = async () => {
    setIsLoading(prev => ({ ...prev, start: true }));
    setError(null);
    try {
      await api.startNode();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(prev => ({ ...prev, start: false }));
    }
  };

  const handleStopNode = async () => {
    setIsLoading(prev => ({ ...prev, stop: true }));
    setError(null);
    try {
      await api.stopNode();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(prev => ({ ...prev, stop: false }));
    }
  };

  const handleWithdraw = async () => {
    setShowWithdrawModal(false);
    setIsLoading(prev => ({ ...prev, withdraw: true }));
    setError(null);
    try {
      await api.withdrawRewards();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(prev => ({ ...prev, withdraw: false }));
    }
  };

  const handleRestake = async () => {
    setShowRestakeModal(false);
    setIsLoading(prev => ({ ...prev, restake: true }));
    setError(null);
    try {
      await api.restake();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(prev => ({ ...prev, restake: false }));
    }
  };

  // Check what's missing in the setup
  const hasWallet = status?.hasWallet;
  const isNodeInitialized = status?.isNodeInitialized;
  const isValidator = status?.isValidator;
  const setupIncomplete = !hasWallet || !isNodeInitialized || !isValidator;
  const canStartNode = hasWallet && isNodeInitialized && isValidator;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard do Validador</h1>
            <p className="text-gray-400">{status?.moniker || 'Meu Validador'}</p>
          </div>
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-white transition"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Setup Warnings */}
        <div className="space-y-3 mb-8">
          {/* Wallet Warning - always show first if no wallet */}
          {!hasWallet && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-red-400 font-semibold">Carteira Necessária</h3>
                    <p className="text-red-400/80 text-sm">
                      Crie ou importe uma carteira para continuar.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => goToStep && goToStep('wallet')}
                  className="flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition"
                >
                  Configurar
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Node Setup Warning - only show if wallet exists but setup incomplete */}
          {hasWallet && (!isNodeInitialized || !isValidator) && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-red-400 font-semibold">Setup Node Incompleto</h3>
                    <p className="text-red-400/80 text-sm">
                      {!isNodeInitialized 
                        ? 'Inicialize o node e crie seu validador.'
                        : 'Crie seu validador para ativar.'
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => goToStep && goToStep('node_setup')}
                  className="flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition"
                >
                  Configurar
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Node Status */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Server className="w-8 h-8 text-blue-400" />
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                status?.isNodeRunning 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {status?.isNodeRunning ? 'Online' : 'Offline'}
              </span>
            </div>
            <h3 className="text-gray-400 text-sm">Status do Node</h3>
            <p className="text-2xl font-bold text-white">
              {status?.isNodeRunning ? 'Rodando' : 'Parado'}
            </p>
          </div>

          {/* Block Height */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Box className="w-8 h-8 text-purple-400" />
              <Activity className="w-5 h-5 text-gray-500" />
            </div>
            <h3 className="text-gray-400 text-sm">Bloco Atual</h3>
            <p className="text-2xl font-bold text-white">
              #{status?.currentBlock?.toLocaleString() || '0'}
            </p>
          </div>

          {/* Peers */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-gray-400 text-sm">Peers Conectados</h3>
            <p className="text-2xl font-bold text-white">
              {status?.peers || 0}
            </p>
          </div>

          {/* Balance */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Coins className="w-8 h-8 text-yellow-400" />
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-gray-400 text-sm">Saldo Disponível</h3>
            <p className="text-2xl font-bold text-white">
              {balance?.display || '0 TKFY'}
            </p>
          </div>

          {/* Staking */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Lock className="w-8 h-8 text-tickfy-400" />
            </div>
            <h3 className="text-gray-400 text-sm">Em Stake</h3>
            <p className="text-2xl font-bold text-white">
              {staking?.totalStaked || '0 TKFY'}
            </p>
            <div className="mt-2 text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Self-delegado:</span>
                <span className="text-gray-400">{staking?.selfDelegation || '0 TKFY'}</span>
              </div>
              <div className="flex justify-between">
                <span>Delegações:</span>
                <span className="text-gray-400">{staking?.delegations || '0 TKFY'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Controles</h2>
          
          <div className="flex flex-wrap gap-4">
            {!status?.isNodeRunning ? (
              <button
                onClick={handleStartNode}
                disabled={isLoading.start || !canStartNode}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={!canStartNode ? 'Complete o Setup Node primeiro (carteira, node e validador)' : ''}
              >
                <Play className="w-5 h-5" />
                {isLoading.start ? 'Iniciando...' : 'Iniciar Node'}
              </button>
            ) : (
              <button
                onClick={handleStopNode}
                disabled={isLoading.stop}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
              >
                <Square className="w-5 h-5" />
                {isLoading.stop ? 'Parando...' : 'Parar Node'}
              </button>
            )}

            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={isLoading.withdraw || !isValidator}
              className="flex items-center gap-2 px-6 py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isValidator ? 'Crie um validador primeiro' : ''}
            >
              <Download className="w-5 h-5" />
              {isLoading.withdraw ? 'Sacando...' : 'Sacar Recompensas'}
            </button>

            <button
              onClick={() => setShowRestakeModal(true)}
              disabled={isLoading.restake || !isValidator}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isValidator ? 'Crie um validador primeiro' : ''}
            >
              <TrendingUp className="w-5 h-5" />
              {isLoading.restake ? 'Stakando...' : 'Stakar Recompensas'}
            </button>
          </div>

          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Logs do Node</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={clearLogs}
                className="text-gray-400 hover:text-white"
                title="Limpar logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={loadLogs}
                className="text-gray-400 hover:text-white"
                title="Atualizar logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="bg-black/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">Nenhum log disponível</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-gray-300 mb-1">
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Validator Info */}
        {status?.isValidator && (
          <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Informações do Validador</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Moniker</p>
                <p className="text-white font-semibold">{status.moniker}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Endereço</p>
                <p className="text-white font-mono text-sm break-all">{status.walletAddress}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <p className="text-green-400 font-semibold">Ativo</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Withdraw Confirmation Modal */}
      <ConfirmModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onConfirm={handleWithdraw}
        title="Sacar Recompensas"
        message="Deseja sacar todas as suas recompensas de validador? Os tokens serão transferidos para sua carteira."
        confirmText="Sacar"
        type="info"
      />

      {/* Restake Confirmation Modal */}
      <ConfirmModal
        isOpen={showRestakeModal}
        onClose={() => setShowRestakeModal(false)}
        onConfirm={handleRestake}
        title="Stakar Recompensas"
        message="Deseja stakar todas as suas recompensas? Os tokens serão delegados automaticamente ao seu validador, aumentando seu stake."
        confirmText="Stakar"
        type="info"
      />
    </div>
  );
}

export default Dashboard;
