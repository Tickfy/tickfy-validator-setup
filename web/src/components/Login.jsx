import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';

function Login({ onComplete }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await api.login(password);
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <img 
            src="/logo.svg" 
            alt="Tickfy Logo" 
            className="w-32 h-32 mx-auto mb-8"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/logo.png';
            }}
          />
          <h1 className="text-4xl font-bold text-white mb-4">Tickfy</h1>
          <p className="text-xl text-tickfy-light-400 mb-6">Validator Dashboard</p>
          <p className="text-gray-400 leading-relaxed">
            Gerencie seu nó validador, acompanhe recompensas e mantenha sua participação na rede Tickfy.
          </p>
          <div className="mt-8 pt-8 border-t border-gray-800">
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
              <span>🔒 Seguro</span>
              <span>⚡ Rápido</span>
              <span>🛡️ Confiável</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-12">
        <div className="max-w-md w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <img 
              src="/logo.svg" 
              alt="Tickfy Logo" 
              className="w-20 h-20 mx-auto mb-4"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/logo.png';
              }}
            />
            <h1 className="text-2xl font-bold text-white">Tickfy Validator</h1>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo de volta</h2>
            <p className="text-gray-400">Digite sua senha para acessar o dashboard</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-gray-400 mb-1">
                  <Lock className="w-4 h-4" />
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-tickfy-500 focus:outline-none pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-tickfy-500 hover:bg-tickfy-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
