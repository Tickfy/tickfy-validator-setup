const API_URL = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token');
    this.password = sessionStorage.getItem('_p'); // Senha em memória (session only)
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  setPassword(password) {
    this.password = password;
    if (password) {
      sessionStorage.setItem('_p', password);
    } else {
      sessionStorage.removeItem('_p');
    }
  }

  getPassword() {
    return this.password || sessionStorage.getItem('_p');
  }

  async request(method, endpoint, body = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro desconhecido');
    }

    return data;
  }

  // Auth
  async getAuthStatus() {
    return this.request('GET', '/auth/status');
  }

  // Dependencies (public - before auth)
  async getDependenciesStatus() {
    return this.request('GET', '/dependencies/status');
  }

  async installDependency(component) {
    return this.request('POST', '/dependencies/install', { component });
  }

  async setup(password) {
    const data = await this.request('POST', '/auth/setup', { password });
    if (data.token) {
      this.setToken(data.token);
      this.setPassword(password); // Guardar senha para uso posterior
    }
    return data;
  }

  async login(password) {
    const data = await this.request('POST', '/auth/login', { password });
    if (data.token) {
      this.setToken(data.token);
      this.setPassword(password); // Guardar senha para uso posterior
    }
    return data;
  }

  logout() {
    this.setToken(null);
    this.setPassword(null); // Limpar senha
  }

  // Wallet - usa senha do dashboard automaticamente
  async createWallet(name) {
    return this.request('POST', '/wallet/create', { name, password: this.getPassword() });
  }

  async importWallet(name, mnemonic) {
    return this.request('POST', '/wallet/import', { name, mnemonic, password: this.getPassword() });
  }

  async getWallets() {
    return this.request('GET', '/wallets');
  }

  async setActiveWallet(walletId) {
    return this.request('POST', '/wallet/active', { walletId });
  }

  async getWalletInfo() {
    return this.request('GET', '/wallet/info');
  }

  async deleteWallet(walletId) {
    return this.request('POST', '/wallet/delete', { walletId });
  }

  async getBalance() {
    return this.request('GET', '/wallet/balance');
  }

  // Node
  async getNodeStatus() {
    return this.request('GET', '/node/status');
  }

  async installNode() {
    return this.request('POST', '/node/install');
  }

  async initNode(moniker) {
    return this.request('POST', '/node/init', { moniker });
  }

  async startNode() {
    return this.request('POST', '/node/start');
  }

  async stopNode() {
    return this.request('POST', '/node/stop');
  }

  async getLogs() {
    return this.request('GET', '/node/logs');
  }

  // Cosmovisor
  async installCosmovisor() {
    return this.request('POST', '/cosmovisor/install');
  }

  async setupCosmovisor() {
    return this.request('POST', '/cosmovisor/setup');
  }

  // Validator - usa senha do dashboard automaticamente
  async createValidator(moniker, commission, stakeAmount) {
    return this.request('POST', '/validator/create', {
      moniker,
      commission,
      stakeAmount,
      password: this.getPassword(),
    });
  }

  async getValidatorStatus() {
    return this.request('GET', '/validator/status');
  }

  async getStakingInfo() {
    return this.request('GET', '/validator/staking');
  }

  async withdrawRewards() {
    return this.request('POST', '/validator/withdraw', { password: this.getPassword() });
  }

  async restake() {
    return this.request('POST', '/validator/restake', { password: this.getPassword() });
  }
}

export const api = new ApiClient();
