(function() {
  'use strict';
  
  const createEmbed = (token, config = {}) => {
    const container = document.createElement('div');
    container.className = 'squidcloud-embed-container';
    container.style.cssText = `
      --theme: ${config.theme || 'dark'};
      --width: ${config.width || '100%'};
      --height: ${config.height || '400px'};
      --border-radius: ${config.borderRadius || 12}px;
    `;
    
    const iframe = document.createElement('iframe');
    const baseUrl = window.location.origin.includes('localhost') 
      ? 'http://localhost:5173' 
      : 'https://squidcloud.vercel.app';
    iframe.src = `${baseUrl}/embed/${token}?theme=${config.theme || 'dark'}`;
    iframe.style.cssText = `
      width: var(--width);
      height: var(--height);
      border: none;
      border-radius: var(--border-radius);
      overflow: hidden;
    `;
    iframe.allowFullscreen = true;
    
    container.appendChild(iframe);
    return container;
  };

  class SquidCloudEmbed extends HTMLElement {
    static get observedAttributes() {
      return ['token', 'theme', 'width', 'height', 'border-radius'];
    }

    constructor() {
      super();
      this._config = {};
    }

    connectedCallback() {
      this._render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue) {
        this._config[name] = newValue;
        if (this.shadowRoot || this.isConnected) {
          this._render();
        }
      }
    }

    _render() {
      if (!this.token) return;
      
      const existing = this.querySelector('iframe');
      if (existing) existing.remove();

      const iframe = document.createElement('iframe');
      const baseUrl = window.location.origin.includes('localhost') 
        ? 'http://localhost:5173' 
        : 'https://squidcloud.vercel.app';
      iframe.src = `${baseUrl}/embed/${this.token}?theme=${this.theme || 'dark'}`;
      iframe.style.cssText = `
        width: ${this.width || '100%'};
        height: ${this.height || '400px'};
        border: none;
        border-radius: ${this['border-radius'] || 12}px;
        overflow: hidden;
      `;
      iframe.allowFullscreen = true;
      
      this.appendChild(iframe);
    }
  }

  if (!customElements.get('squidcloud-embed')) {
    customElements.define('squidcloud-embed', SquidCloudEmbed);
  }

  window.SquidCloudEmbed = { createEmbed };
})();