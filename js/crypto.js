const IV = '9859102938491658';
const ALG = { name: 'AES-CBC', iv: new Uint8Array(Array.from(IV).map(ch => ch.charCodeAt(0))) };

class Scrambler {
  constructor(key) {
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)).then(keyHash => {
      crypto.subtle.importKey('raw', keyHash, ALG, true, ['encrypt', 'decrypt']).then(key => {
        this.key = key;
      });
    });
  }

  async decrypt(ciphertext) {
    const ct = atob(ciphertext);
    try {
      const b = await crypto.subtle.decrypt(ALG, this.key, new Uint8Array(Array.from(ct).map(ch => ch.charCodeAt(0))));
      return new TextDecoder().decode(b);
    } catch(e) {
      console.dir(e);
      return '';
    }
  }

  async encrypt(plaintext) {
    const pt = new TextEncoder().encode(plaintext);
    try {
      const ct = await crypto.subtle.encrypt(ALG, this.key, pt);
      const a = Array.from(new Uint8Array(ct));
      const s = a.map(byte => String.fromCharCode(byte)).join('');
      return btoa(s);
    } catch(e) {
      console.dir(e);
      return '';
    }
  }
}

export { Scrambler }