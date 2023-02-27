class NtfyClient {
  constructor(app, client, host, topic, user, pass) {
    this.app = app;
    this.client = client;
    let authPart = '';
    if (user && pass) {
      const header = `Basic ${window.btoa(`${user}:${pass}`)}`;
      authPart = '?auth=' + window.btoa(header).replace(/=+$/g, '');
    }
    this.subUrl = `${host}/${topic}/sse${authPart}`;
    this.postUrl = `${host}/${topic}${authPart}`;

    this.eventSource = new EventSource(this.subUrl);
    this.eventSource.onmessage = (e) => {
      this.handleEvent(e);
    }
  }

  async handleEvent(e) {
    const message = JSON.parse(e.data);
    if (message.title === this.client) return;
    if (this.app.state.backend.encryptionkey) {
      try {
        message.message = await this.app.state.scrambler.decrypt(message.message);
      } catch(e) {
        console.dir(e);
      }
    }
    this.app.clipReceived(message.title, message.message, Date.now());
  }

  sendClip(contents) {
    fetch(this.postUrl, {
      method: 'POST',
      body: contents,
      headers: {
        'Title': this.client,
        'Priority': 'min'
      }
    })
  }

  close() { this.eventSource.close(); }
}

export { NtfyClient }