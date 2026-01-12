import React, { useState, useEffect } from 'react';
import { Wallet, Server, Shield, Check, ChevronRight, RefreshCw, AlertTriangle, Trash2, Info, Percent, Coins } from 'lucide-react';
import { api } from '../lib/api';
import ConfirmModal from './ConfirmModal';

// Random moniker generator
const PREFIXES = ['alfa', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'theta', 'lambda', 'omega', 'sigma'];
const WORDS = [
  'nova', 'star', 'moon', 'sun', 'sky', 'cloud', 'storm', 'wind', 'fire', 'ice',
  'rock', 'wave', 'peak', 'vale', 'river', 'lake', 'ocean', 'forest', 'desert', 'mountain',
  'tiger', 'eagle', 'wolf', 'bear', 'lion', 'hawk', 'phoenix', 'dragon', 'falcon', 'panther',
  'cyber', 'crypto', 'chain', 'block', 'node', 'hash', 'stake', 'yield', 'vault', 'nexus'
];

function generateRandomMoniker() {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const word1 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const word2 = WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${prefix}-${word1}-${word2}`;
}

function NodeSetupWizard({ nodeStatus, onComplete, onRefresh }) {
  const [step, setStep] = useState(1); // 1: Select Wallet, 2: Init Node, 3: Create Validator
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Wallet selection state
  const [wallets, setWallets] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState(null);
  const [activeWalletId, setActiveWalletId] = useState(null);
  
  // Node init state
  const [moniker, setMoniker] = useState(generateRandomMoniker());
  
  // Validator state
  const [commissionPreset, setCommissionPreset] = useState('10'); // '5', '10', '15', '20', 'custom'
  const [customCommission, setCustomCommission] = useState('');
  const [stakeAmount, setStakeAmount] = useState('200000');
  const [details, setDetails] = useState('');
  const [website, setWebsite] = useState('');
  const [walletBalance, setWalletBalance] = useState(null);

  // Commission presets
  const commissionPresets = [
    { 
      value: '5', 
      label: '5%', 
      title: 'Competitivo',
      description: 'Atrair mais delegadores'
    },
    { 
      value: '10', 
      label: '10%', 
      title: 'Recomendado',
      description: 'Equilíbrio ideal'
    },
    { 
      value: '15', 
      label: '15%', 
      title: 'Premium',
      description: 'Alta reputação'
    },
    { 
      value: '20', 
      label: '20%', 
      title: 'Máximo',
      description: 'Maior receita'
    },
  ];

  const getCommissionRate = () => {
    if (commissionPreset === 'custom') {
      return customCommission || '10';
    }
    return commissionPreset;
  };

  useEffect(() => {
    loadWallets();
  }, []);

  useEffect(() => {
    // Auto-advance based on nodeStatus
    if (nodeStatus?.isNodeInitialized && step === 2) {
      setStep(3);
    }
    if (nodeStatus?.isValidator && step === 3) {
      // Setup complete
    }
  }, [nodeStatus]);

  // Load balance when entering step 3
  useEffect(() => {
    if (step === 3) {
      loadBalance();
    }
  }, [step]);

  const loadWallets = async () => {
    try {
      const data = await api.getWallets();
      setWallets(data.wallets || []);
      setActiveWalletId(data.activeWalletId || null);
      setSelectedWalletId(data.activeWalletId || null);
    } catch (err) {
      // No wallets
    }
  };

  const loadBalance = async () => {
    try {
      const balance = await api.getBalance();
      setWalletBalance(balance);
    } catch (err) {
      // Ignore
    }
  };

  const regenerateMoniker = () => {
    setMoniker(generateRandomMoniker());
  };

  const handleSelectWallet = async () => {
    if (!selectedWalletId) {
      setError('Selecione uma carteira');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (selectedWalletId !== activeWalletId) {
        await api.setActiveWallet(selectedWalletId);
        setActiveWalletId(selectedWalletId);
      }
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitNode = async () => {
    if (!moniker) {
      setError('Digite um nome para o node');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.initNode(moniker);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateValidator = async () => {
    // Get the commission rate
    const rate = parseFloat(getCommissionRate());
    const stake = parseFloat(stakeAmount);

    if (commissionPreset === 'custom') {
      if (isNaN(rate) || rate < 0 || rate > 20) {
        setError('Taxa de comissão customizada deve ser entre 0% e 20%');
        return;
      }
    }

    if (isNaN(stake) || stake < 200000) {
      setError('Stake mínimo é 200,000 TKFY');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Convert percentages to decimal
      const commission = (rate / 100).toString();
      await api.createValidator(moniker, commission, stakeAmount);
      onRefresh();
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfig = async () => {
    setShowDeleteModal(false);
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement delete validator API
      setError('Funcionalidade ainda não implementada no backend');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { num: 1, title: 'Selecionar Carteira', icon: Wallet },
    { num: 2, title: 'Inicializar Node', icon: Server },
    { num: 3, title: 'Criar Validador', icon: Shield },
  ];

  // Show completed state if already a validator
  if (nodeStatus?.isValidator) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-600 flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Validador Configurado!</h2>
            <p className="text-gray-400">
              Seu node está validando na rede Tickfy
            </p>
          </div>

          <div className="bg-gray-800/50 border border-green-500/30 rounded-xl p-6 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Moniker</span>
                <span className="text-white">{nodeStatus.moniker || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className="text-green-400">Ativo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Endereço</span>
                <span className="text-gray-300 font-mono text-xs break-all">{nodeStatus.walletAddress || '-'}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={isLoading}
            className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Configuração
          </button>

          <p className="text-center text-gray-500 text-xs mt-4">
            Isso irá remover toda a configuração do validador
          </p>

          <ConfirmModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteConfig}
            title="Excluir Configuração"
            message="Tem certeza que deseja excluir toda a configuração do validador? Esta ação não pode ser desfeita."
            confirmText="Excluir"
            type="danger"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    step > s.num
                      ? 'bg-green-600 text-white'
                      : step === s.num
                      ? 'bg-tickfy-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {step > s.num ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <s.icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-xs mt-2 ${
                    step >= s.num ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {s.title}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 -mt-6 ${
                    step > s.num ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          {/* Step 1: Select Wallet */}
          {step === 1 && (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Selecionar Carteira</h3>
              <p className="text-gray-400 text-sm mb-6">
                Escolha qual carteira será usada para o validador
              </p>

              {wallets.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">Nenhuma carteira encontrada</p>
                  <p className="text-gray-500 text-sm">
                    Vá para a seção Carteiras e crie uma primeiro
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => setSelectedWalletId(wallet.id)}
                      className={`w-full p-4 rounded-xl border transition-all text-left ${
                        selectedWalletId === wallet.id
                          ? 'bg-tickfy-500/20 border-tickfy-500'
                          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{wallet.name}</p>
                          <p className="text-gray-400 font-mono text-xs break-all">
                            {wallet.address}
                          </p>
                        </div>
                        {selectedWalletId === wallet.id && (
                          <Check className="w-5 h-5 text-tickfy-400 ml-2 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={handleSelectWallet}
                disabled={isLoading || wallets.length === 0}
                className="w-full py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Processando...' : 'Próximo'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Step 2: Initialize Node */}
          {step === 2 && (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Inicializar Node</h3>
              <p className="text-gray-400 text-sm mb-6">
                Configure o nome do seu node na rede
              </p>

              <div className="mb-6">
                <label className="text-gray-400 mb-2 block">Nome do Node (Moniker)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={moniker}
                    onChange={(e) => setMoniker(e.target.value)}
                    placeholder="Ex: alfa-nova-star"
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none"
                  />
                  <button
                    onClick={regenerateMoniker}
                    className="px-3 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    title="Gerar novo nome"
                  >
                    <RefreshCw className="w-5 h-5 text-gray-300" />
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  Este nome será visível publicamente na rede
                </p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={handleInitNode}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Processando...' : 'Próximo'}
                  {!isLoading && <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Create Validator */}
          {step === 3 && (
            <>
              <h3 className="text-xl font-bold text-white mb-2">Criar Validador</h3>
              <p className="text-gray-400 text-sm mb-6">
                Configure as taxas de comissão e o stake inicial
              </p>

              <div className="space-y-4 mb-6">
                {/* Commission Settings */}
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Percent className="w-5 h-5 text-tickfy-400" />
                    <h4 className="text-white font-semibold">Taxa de Comissão</h4>
                  </div>

                  <p className="text-gray-400 text-sm mb-4">
                    Percentual das recompensas que você recebe dos delegadores
                  </p>

                  {/* Preset options */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {commissionPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setCommissionPreset(preset.value)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          commissionPreset === preset.value
                            ? 'bg-tickfy-500/20 border-tickfy-500'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-xl font-bold text-white">{preset.label}</div>
                        <div className={`text-xs font-medium ${
                          commissionPreset === preset.value ? 'text-tickfy-400' : 'text-gray-400'
                        }`}>
                          {preset.title}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 leading-tight">
                          {preset.description}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Custom option */}
                  <button
                    onClick={() => setCommissionPreset('custom')}
                    className={`w-full p-3 rounded-xl border-2 transition-all ${
                      commissionPreset === 'custom'
                        ? 'bg-tickfy-500/20 border-tickfy-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="text-white font-semibold">Personalizado</div>
                        <div className="text-xs text-gray-400">Defina sua própria taxa (máx. 20%)</div>
                      </div>
                      {commissionPreset === 'custom' && (
                        <Check className="w-5 h-5 text-tickfy-400" />
                      )}
                    </div>
                  </button>

                  {/* Custom input */}
                  {commissionPreset === 'custom' && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={customCommission}
                          onChange={(e) => setCustomCommission(e.target.value)}
                          min="0"
                          max="20"
                          step="0.1"
                          placeholder="Ex: 8"
                          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none"
                        />
                        <span className="text-gray-400 font-medium">%</span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        Digite um valor entre 0% e 20%
                      </p>
                    </div>
                  )}
                </div>

                {/* Stake Settings */}
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-400" />
                      <h4 className="text-white font-semibold">Stake Inicial</h4>
                    </div>
                    {walletBalance && (
                      <div className="text-right">
                        <span className="text-gray-400 text-xs">Saldo disponível: </span>
                        <span className="text-green-400 text-sm font-semibold">{walletBalance.display}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Quantidade (TKFY)</label>
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      min="200000"
                      step="1000"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Mínimo: 200,000 TKFY - Estes tokens serão bloqueados como garantia
                    </p>
                  </div>
                </div>

                {/* Optional Info */}
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-blue-400" />
                    <h4 className="text-white font-semibold">Informações Opcionais</h4>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 text-sm mb-1 block">Website</label>
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://seu-site.com"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm mb-1 block">Descrição</label>
                      <textarea
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder="Descreva seu validador..."
                        rows={2}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-semibold text-sm mb-1">Atenção!</p>
                    <ul className="text-yellow-400/80 text-xs space-y-1 list-disc list-inside">
                      <li>Certifique-se de que sua carteira tem saldo suficiente</li>
                      <li>Os tokens em stake ficam bloqueados por 21 dias ao fazer unstake</li>
                      <li>Se seu validador ficar offline, você pode perder parte do stake (slashing)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={handleCreateValidator}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Criando Validador...' : 'Criar Validador'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default NodeSetupWizard;
