import React, { useState, useEffect } from 'react';
import { Shield, Coins, Percent, AlertTriangle, Loader2, ArrowLeft, Info, Copy, Check } from 'lucide-react';
import { api } from '../lib/api';

function ValidatorSetup({ onComplete, onBack }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletInfo, setWalletInfo] = useState(null);
  const [balance, setBalance] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    commission: '0.10',
    stakeAmount: '',
  });

  const MIN_STAKE = 200000;

  useEffect(() => {
    loadWalletInfo();
  }, []);

  const loadWalletInfo = async () => {
    try {
      const info = await api.getWalletInfo();
      setWalletInfo(info);
      const bal = await api.getBalance();
      setBalance(bal);
    } catch (err) {
      console.error(err);
    }
  };

  const copyAddress = async () => {
    if (walletInfo?.address) {
      await navigator.clipboard.writeText(walletInfo.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateValidator = async () => {
    const stakeAmount = parseInt(formData.stakeAmount);
    
    if (!stakeAmount || stakeAmount < MIN_STAKE) {
      setError(`Stake mínimo é ${MIN_STAKE.toLocaleString()} TKFY`);
      return;
    }

    if (balance && stakeAmount > balance.tkfy) {
      setError(`Saldo insuficiente. Você tem ${balance.display}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const status = await api.getNodeStatus();
      await api.createValidator(
        status.moniker || 'Validator',
        formData.commission,
        (stakeAmount * 1000000).toString()
      );
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const commissionOptions = [
    { value: '0.05', label: '5%', desc: 'Mais competitivo' },
    { value: '0.10', label: '10%', desc: 'Padrão' },
    { value: '0.15', label: '15%', desc: 'Equilibrado' },
    { value: '0.20', label: '20%', desc: 'Máximo' },
  ];

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
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-tickfy-500 flex items-center justify-center">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Criar Validador</h2>
          <p className="text-gray-400">
            Faça stake de TKFY e comece a validar
          </p>
        </div>

        {/* Wallet Info */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">Sua Carteira</span>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition"
              title="Copiar endereço"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="text-xs">{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <div className="bg-gray-900 rounded-lg p-2 mb-3">
            <p className="text-white font-mono text-xs break-all select-all">
              {walletInfo?.address || '...'}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Saldo Disponível</span>
            <span className={`font-semibold ${
              balance && balance.tkfy >= MIN_STAKE ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {balance ? balance.display : 'Carregando...'}
            </span>
          </div>
        </div>

        {/* Warning if insufficient balance */}
        {balance && balance.tkfy < MIN_STAKE && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-500 font-semibold">Saldo Insuficiente</p>
                <p className="text-sm text-yellow-400/80 mt-1">
                  Você precisa de pelo menos {MIN_STAKE.toLocaleString()} TKFY para criar um validador.
                  Deposite mais tokens na sua carteira.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Stake Amount */}
          <div>
            <label className="flex items-center gap-2 text-gray-400 mb-1">
              <Coins className="w-4 h-4" />
              Quantidade de Stake
            </label>
            <div className="relative">
              <input
                type="number"
                name="stakeAmount"
                value={formData.stakeAmount}
                onChange={handleInputChange}
                placeholder={`Mínimo ${MIN_STAKE.toLocaleString()}`}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">TKFY</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tokens ficam bloqueados enquanto você é validador
            </p>
          </div>

          {/* Commission */}
          <div>
            <label className="flex items-center gap-2 text-gray-400 mb-2">
              <Percent className="w-4 h-4" />
              Taxa de Comissão
            </label>
            <div className="grid grid-cols-4 gap-2">
              {commissionOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormData(prev => ({ ...prev, commission: opt.value }))}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    formData.commission === opt.value
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Comissão é a % que você cobra dos delegadores sobre as recompensas deles
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleCreateValidator}
            disabled={isLoading || (balance && balance.tkfy < MIN_STAKE)}
            className="w-full py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isLoading ? 'Criando Validador...' : 'Criar Validador'}
          </button>
        </div>

        {/* Info box */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300/80">
              <p className="font-semibold text-blue-300 mb-1">Importante</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Seu node precisa estar sincronizado para validar</li>
                <li>Se ficar offline, você pode ser penalizado (slashing)</li>
                <li>Recompensas acumulam automaticamente</li>
                <li>Para sacar, é necessário um período de unbonding (21 dias)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ValidatorSetup;
