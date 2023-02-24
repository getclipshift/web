class NostrClient {
  constructor(app, client, host, pk) {
    this.app = app;
    this.client = client;
    this.host = host;
    this.pk = pk;
    this.pubKey = window.NostrTools.getPublicKey(pk);

    this.ws = new WebSocket(this.host);
    this.connect();
  }

  connect() {
    this.ws.addEventListener('open', () => {
      this.ws.send(JSON.stringify(['REQ', this.client, {limit: 1, kinds: [4], authors: [this.pubKey]}]));
    });
    
    // Listen for messages
    this.ws.addEventListener('message', (event) => {
        this.handleEvent(event);
    });
    this.ws.addEventListener('error', (event) => {
        console.log('Error from server ', event.data);
        this.close();
        setTimeout(this.connect, 5000);
    });
    this.ws.addEventListener('close', (event) => {
        console.log('Close from server ', event.data);
        this.close();
        setTimeout(this.connect, 30000);
    });
  }

  handleEvent(e) {
    const content = JSON.parse(e.data);
    if (!Array.isArray(content) || content[0] !== 'EVENT') return;
    NostrTools.nip04.decrypt(this.pk, this.pubKey, content[2].content).then(decrypted => {
      if (!decrypted) return;
      const [client, message] = decrypted.split(/---(.*)/s);
      if (message) this.app.clipReceived(client, message);
    });
  }

  sendClip(contents) {
    NostrTools.nip04.encrypt(this.pk, this.pubKey, `${this.client}---${contents}`).then((cipherText) => {
      const event = {kind: 4, created_at: Math.floor(Date.now() / 1000), pubkey: this.pubKey, tags: [['p', this.pk]], content: cipherText};
      event.id = NostrTools.getEventHash(event);
      event.sig = NostrTools.signEvent(event, this.pk);
      this.ws.send(JSON.stringify(['EVENT', event]));
    });
  }

  close() {
    this.ws.close();
  }
}

export { NostrClient }