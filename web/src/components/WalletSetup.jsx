import React, { useState, useEffect, useRef } from 'react';
import { Wallet, Plus, Download, Eye, EyeOff, AlertTriangle, CheckCircle, Copy, Check, Trash2, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import ConfirmModal from './ConfirmModal';

function WalletSetup({ nodeStatus, onComplete }) {
  const [mode, setMode] = useState(null); // 'create' | 'import'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [walletToDelete, setWalletToDelete] = useState(null);
  const topRef = useRef(null);
  
  // Create wallet state
  const [createdWallet, setCreatedWallet] = useState(null);
  const [savedMnemonic, setSavedMnemonic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    mnemonic: '',
  });
  const [showMnemonic, setShowMnemonic] = useState(false);

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    try {
      const data = await api.getWallets();
      setWallets(data.wallets || []);
    } catch (err) {
      // No wallets yet
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreate = async () => {
    if (!formData.name) {
      setError('Digite um nome para a carteira');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.createWallet(formData.name);
      setCreatedWallet(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!formData.name || !formData.mnemonic) {
      setError('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.importWallet(formData.name, formData.mnemonic.trim());
      await loadWallets();
      setMode(null);
      setFormData({ name: '', mnemonic: '' });
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (wallet) => {
    setWalletToDelete(wallet);
  };

  const handleDeleteConfirm = async () => {
    if (!walletToDelete) return;

    setDeletingId(walletToDelete.id);
    setError(null);

    try {
      await api.deleteWallet(walletToDelete.id);
      loadWallets();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
      setWalletToDelete(null);
    }
  };

  const copyMnemonic = async () => {
    if (createdWallet?.mnemonic) {
      await navigator.clipboard.writeText(createdWallet.mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyAddress = async (address) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleConfirmSaved = async () => {
    if (savedMnemonic) {
      await loadWallets();
      setCreatedWallet(null);
      setSavedMnemonic(false);
      setFormData({ name: '', mnemonic: '' });
      setMode(null); // Volta para lista de carteiras
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  // Show mnemonic screen after creation
  if (createdWallet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Carteira Criada!</h2>
            <p className="text-gray-400">
              Salve suas 24 palavras em um local seguro
            </p>
          </div>

          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
              <div>
                <p className="text-yellow-500 font-semibold">IMPORTANTE!</p>
                <p className="text-sm text-yellow-400/80 mt-1">
                  Estas palavras são a ÚNICA forma de recuperar sua carteira.
                  Nunca compartilhe com ninguém. Guarde em um local seguro offline.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Seu Endereço</span>
              <span className="text-white font-mono text-sm">{createdWallet.address}</span>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Frase de Recuperação</span>
              <button
                onClick={copyMnemonic}
                className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="text-xs">{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {createdWallet.mnemonic.split(' ').map((word, index) => (
                <div 
                  key={index} 
                  className="bg-gray-900 rounded-lg p-2 relative"
                >
                  <span className="absolute top-1 left-2 text-[10px] text-gray-500">{index + 1}</span>
                  <p className="text-white font-mono text-sm text-center pt-3 select-all">
                    {word}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl cursor-pointer hover:bg-gray-800 transition mb-4">
            <input
              type="checkbox"
              checked={savedMnemonic}
              onChange={(e) => setSavedMnemonic(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 text-tickfy-500 focus:ring-tickfy-400"
            />
            <span className="text-gray-300">
              Eu salvei minhas 24 palavras em um local seguro
            </span>
          </label>

          <button
            onClick={handleConfirmSaved}
            disabled={!savedMnemonic}
            className="w-full py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // Create or Import form
  if (mode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              mode === 'create' 
                ? 'bg-tickfy-500' 
                : 'bg-gradient-to-r from-blue-600 to-cyan-600'
            }`}>
              {mode === 'create' ? <Plus className="w-10 h-10 text-white" /> : <Download className="w-10 h-10 text-white" />}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {mode === 'create' ? 'Criar Nova Carteira' : 'Importar Carteira'}
            </h2>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 mb-1 block">Nome da Carteira</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Meu Validador"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none"
                />
              </div>

              {mode === 'import' && (
                <div>
                  <label className="text-gray-400 mb-1 block">Frase de Recuperação (24 palavras)</label>
                  <div className="relative">
                    <textarea
                      name="mnemonic"
                      value={formData.mnemonic}
                      onChange={handleInputChange}
                      placeholder="Digite suas 24 palavras separadas por espaço"
                      rows={3}
                      className={`w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none resize-none ${
                        showMnemonic ? '' : 'text-security-disc'
                      }`}
                      style={!showMnemonic ? { WebkitTextSecurity: 'disc' } : {}}
                    />
                    <button
                      type="button"
                      onClick={() => setShowMnemonic(!showMnemonic)}
                      className="absolute right-3 top-3 text-gray-500 hover:text-white"
                    >
                      {showMnemonic ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMode(null);
                    setError(null);
                    setFormData({ name: '', mnemonic: '' });
                  }}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={mode === 'create' ? handleCreate : handleImport}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Processando...' : mode === 'create' ? 'Criar Carteira' : 'Importar Carteira'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Wallet list view
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div ref={topRef} className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-tickfy-500 flex items-center justify-center">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Minhas Carteiras</h2>
          <p className="text-gray-400">
            {wallets.length === 0 
              ? 'Adicione uma carteira para começar' 
              : 'Gerencie suas carteiras'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Wallet list */}
        {wallets.length > 0 && (
          <div className="space-y-3 mb-6">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 transition-all hover:border-gray-600"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-medium">{wallet.name}</span>
                  <button
                    onClick={() => handleDeleteClick(wallet)}
                    disabled={deletingId === wallet.id}
                    className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-xs break-all select-all pr-2">
                    {wallet.address}
                  </span>
                  <button
                    onClick={() => copyAddress(wallet.address)}
                    className="text-gray-500 hover:text-white flex-shrink-0"
                  >
                    {copiedAddress === wallet.address ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add wallet options */}
        <div className="space-y-3">
          <button
            onClick={() => setMode('create')}
            className="w-full p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-purple-500 transition-all group text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-tickfy-500/20 flex items-center justify-center group-hover:bg-tickfy-500/30 transition">
                  <Plus className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Criar Nova Carteira</h3>
                  <p className="text-xs text-gray-400">Gere uma nova carteira com 24 palavras</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => setMode('import')}
            className="w-full p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-purple-500 transition-all group text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition">
                  <Download className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Importar Carteira</h3>
                  <p className="text-xs text-gray-400">Use suas 24 palavras existentes</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400" />
            </div>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!walletToDelete}
        onClose={() => setWalletToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Remover Carteira"
        message={`Tem certeza que deseja remover a carteira "${walletToDelete?.name}"? Você precisará das 24 palavras para adicioná-la novamente.`}
        confirmText="Remover"
        type="danger"
      />
    </div>
  );
}

export default WalletSetup;
